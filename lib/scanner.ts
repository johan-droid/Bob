import { get, query, run } from './db';
import { decryptToken } from './auth';

const GITHUB_API = 'https://api.github.com';
const DEFAULT_AGENT_HINTS = ['codex', 'copilot', 'jules'];
const CONFIGURED_AGENT_HINTS = (process.env.AGENT_IDENTITIES || '')
  .split(',')
  .map(v => v.trim().toLowerCase())
  .filter(Boolean);
const AGENT_HINTS = CONFIGURED_AGENT_HINTS.length > 0 ? CONFIGURED_AGENT_HINTS : DEFAULT_AGENT_HINTS;

export interface ScanResult {
  repo: string;
  conflicting_prs: any[];
  workflow_failures: any[];
  review_issues: any[];
  stale_prs: any[];
  oversized_prs: any[];
  total_prs: number;
  healthy_prs: number;
  pr_heads: Array<{ pr: number; head_sha: string }>;
}

type PrScanStateRow = {
  pr_number: number;
  head_sha?: string | null;
  last_scanned_at?: string | null;
};

type ScanRepositoryOptions = {
  prStateByNumber?: Map<number, PrScanStateRow>;
  unresolvedIssueTypesByPr?: Map<number, Set<string>>;
  scanFreshnessMs?: number;
  force?: boolean;
};

type RunScanOptions = {
  repos?: string[];
  reason?: string;
  force?: boolean;
};

const DEFAULT_PR_SCAN_FRESHNESS_MS = Number(process.env.PR_SCAN_FRESHNESS_MS || 5 * 60 * 1000);
const DEFAULT_WEBHOOK_REPO_DEBOUNCE_MS = Number(process.env.WEBHOOK_REPO_DEBOUNCE_MS || 45 * 1000);

function resolveWriteToken(userToken: string): string {
  const botToken = (process.env.GITHUB_TOKEN || '').trim();
  return botToken || userToken;
}

export class PRHealthScanner {
  private token: string;
  private repos: string[];
  public assignee: string;
  private autoLabelConflict: boolean;
  private tagAuthorOnFail: boolean;

  constructor(
    token: string,
    repos: string[],
    assignee = 'jules',
    autoLabelConflict = true,
    tagAuthorOnFail = false
  ) {
    this.token = token;
    this.repos = repos;
    this.assignee = assignee;
    this.autoLabelConflict = autoLabelConflict;
    this.tagAuthorOnFail = tagAuthorOnFail;
  }

  private async fetchGitHub(url: string, method = 'GET', body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Bob-PR-Health-Scanner'
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      // Handle Rate Limiting
      const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '999', 10);
      if (remaining < 10) {
        const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10);
        const waitMs = Math.max(0, (resetAt * 1000) - Date.now()) + 2000;
        console.warn(`GitHub Rate limit low (${remaining}), waiting ${Math.round(waitMs / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }

      if (response.status === 204) {
        return { success: true };
      }

      if (!response.ok) {
        const errText = await response.text();
        return { error: `HTTP ${response.status}: ${errText}` };
      }

      return await response.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }

  public async getOpenPRs(repo: string): Promise<any[]> {
    const res = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/pulls?state=open&per_page=100`);
    return Array.isArray(res) ? res : [];
  }

  public async checkMergeConflict(repo: string, prNumber: number): Promise<boolean> {
    const pr = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}`);
    return pr && pr.mergeable === false;
  }

  public async getPRReviews(repo: string, prNumber: number): Promise<any> {
    const reviews = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}/reviews`);
    if (!Array.isArray(reviews)) {
      return {
        status: 'unknown',
        reviewers: [],
        approved_count: 0,
        changes_requested_count: 0,
        pending_count: 0
      };
    }

    // Get latest review state per reviewer
    const latestReviews: Record<string, any> = {};
    for (const r of reviews) {
      const reviewer = r.user?.login;
      const state = r.state?.toUpperCase();
      if (reviewer && ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'].includes(state)) {
        latestReviews[reviewer] = {
          reviewer,
          state,
          submitted_at: r.submitted_at,
          avatar: r.user?.avatar_url || ''
        };
      }
    }

    const reviewersList = Object.values(latestReviews);
    const approved = reviewersList.filter(r => r.state === 'APPROVED').length;
    const changesReq = reviewersList.filter(r => r.state === 'CHANGES_REQUESTED').length;

    // Fetch requested reviewers who haven't reviewed yet
    const reqReviewers = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}/requested_reviewers`);
    const pendingReviewers: any[] = [];
    if (reqReviewers && Array.isArray(reqReviewers.users)) {
      for (const u of reqReviewers.users) {
        pendingReviewers.push({
          reviewer: u.login,
          state: 'PENDING',
          submitted_at: null,
          avatar: u.avatar_url || ''
        });
      }
    }

    const allReviewers = [...reviewersList, ...pendingReviewers];
    let overall = 'no_reviewers';
    if (changesReq > 0) {
      overall = 'changes_requested';
    } else if (approved > 0 && pendingReviewers.length === 0) {
      overall = 'approved';
    } else if (allReviewers.length > 0) {
      overall = 'review_pending';
    }

    return {
      status: overall,
      reviewers: allReviewers,
      approved_count: approved,
      changes_requested_count: changesReq,
      pending_count: pendingReviewers.length
    };
  }

  public computePRAge(pr: any): any {
    const now = Date.now();
    const createdTime = pr.created_at ? new Date(pr.created_at).getTime() : now;
    const updatedTime = pr.updated_at ? new Date(pr.updated_at).getTime() : now;

    const daysOpen = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
    const daysSinceUpdate = Math.floor((now - updatedTime) / (1000 * 60 * 60 * 24));

    let staleness = 'active';
    if (daysSinceUpdate >= 14) {
      staleness = 'abandoned';
    } else if (daysSinceUpdate >= 7) {
      staleness = 'stale';
    } else if (daysSinceUpdate >= 3) {
      staleness = 'aging';
    }

    const additions = pr.additions || 0;
    const deletions = pr.deletions || 0;
    const totalChanges = additions + deletions;

    let size = 'small';
    if (totalChanges > 1000) {
      size = 'xl';
    } else if (totalChanges > 500) {
      size = 'large';
    } else if (totalChanges > 100) {
      size = 'medium';
    }

    return {
      days_open: daysOpen,
      days_since_update: daysSinceUpdate,
      staleness,
      additions,
      deletions,
      total_changes: totalChanges,
      size
    };
  }

  public async getPRDetail(repo: string, prNumber: number): Promise<any> {
    const res = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}`);
    return res && !res.error ? res : null;
  }

  public async scanWorkflowFailures(repo: string): Promise<any[]> {
    const res = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/actions/runs?status=failure&per_page=10`);
    if (!res || !Array.isArray(res.workflow_runs)) {
      return [];
    }

    return res.workflow_runs.map((r: any) => ({
      id: r.id,
      name: r.name,
      conclusion: r.conclusion,
      branch: r.head_branch,
      html_url: r.html_url,
      created_at: r.created_at,
      author: r.triggering_actor?.login || r.head_commit?.author?.name || 'github-actions'
    }));
  }

  public async createIssue(repo: string, title: string, body: string, labels: string[]): Promise<any> {
    // Check duplication
    const issues = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/issues?state=open&labels=needs-fix&per_page=50`);
    if (Array.isArray(issues)) {
      const prefix = title.substring(0, 60);
      const exists = issues.some((i: any) => i.title?.startsWith(prefix));
      if (exists) {
        return { skipped: true, reason: 'duplicate' };
      }
    }

    return await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/issues`, 'POST', {
      title,
      body,
      labels
    });
  }

  public async addLabel(repo: string, prNumber: number, label: string): Promise<any> {
    return await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/issues/${prNumber}/labels`, 'POST', {
      labels: [label]
    });
  }

  public async createComment(repo: string, prNumber: number, body: string): Promise<any> {
    return await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/issues/${prNumber}/comments`, 'POST', {
      body
    });
  }

  public async rerunWorkflow(repo: string, runId: number): Promise<any> {
    return await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/rerun-failed-jobs`, 'POST');
  }

  public async requestReview(repo: string, prNumber: number, reviewers: string[]): Promise<any> {
    return await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}/requested_reviewers`, 'POST', {
      reviewers
    });
  }

  private isAgentLogin(login: string): boolean {
    const normalized = (login || '').toLowerCase();
    if (!normalized) return false;
    if (normalized.endsWith('[bot]')) return true;
    return AGENT_HINTS.some((hint) => normalized.includes(hint));
  }

  public async getLiveAgentsForRepo(repo: string): Promise<string[]> {
    const res = await this.fetchGitHub(`${GITHUB_API}/repos/${repo}/contributors?per_page=100`);
    if (!Array.isArray(res)) return [];

    const unique = new Set<string>();
    for (const contributor of res) {
      const login = contributor?.login;
      if (typeof login === 'string' && this.isAgentLogin(login)) {
        unique.add(login);
      }
    }

    return [...unique];
  }

  public async scanRepository(repo: string, options: ScanRepositoryOptions = {}): Promise<ScanResult> {
    const now = Date.now();
    const freshnessMs = options.scanFreshnessMs ?? DEFAULT_PR_SCAN_FRESHNESS_MS;
    const results: ScanResult = {
      repo,
      conflicting_prs: [],
      workflow_failures: [],
      review_issues: [],
      stale_prs: [],
      oversized_prs: [],
      total_prs: 0,
      healthy_prs: 0,
      pr_heads: []
    };

    const prs = await this.getOpenPRs(repo);
    results.total_prs = prs.length;

    for (const pr of prs) {
      const prNum = pr.number;
      const prTitle = pr.title || 'Untitled';
      const prUrl = pr.html_url || '';
      const prAuthor = pr.user?.login || 'Unknown';
      const headBranch = pr.head?.ref || '';
      const headSha = pr.head?.sha || '';
      results.pr_heads.push({ pr: prNum, head_sha: headSha });
      let hasIssues = false;

      const cached = options.prStateByNumber?.get(prNum);
      const cachedAt = cached?.last_scanned_at ? new Date(cached.last_scanned_at).getTime() : 0;
      const isFresh = cachedAt > 0 && now - cachedAt < freshnessMs;
      const isSameHead = !!headSha && !!cached?.head_sha && headSha === cached.head_sha;
      const unresolvedTypes = options.unresolvedIssueTypesByPr?.get(prNum);
      const hasUnresolvedIssueInDb = !!unresolvedTypes && unresolvedTypes.size > 0;
      const canUseCachedState = !options.force && isFresh && isSameHead;

      if (canUseCachedState) {
        if (hasUnresolvedIssueInDb) {
          hasIssues = true;
        }
        if (!hasIssues) {
          results.healthy_prs++;
        }
        continue;
      }

      // 1. Merge conflict detection
      const isConflicting = await this.checkMergeConflict(repo, prNum);
      if (isConflicting) {
        results.conflicting_prs.push({
          pr: prNum,
          title: prTitle,
          url: prUrl,
          head_branch: headBranch,
          author: prAuthor
        });
        hasIssues = true;
      }

      // 2. Review status tracking
      const reviewInfo = await this.getPRReviews(repo, prNum);
      if (reviewInfo.status === 'changes_requested') {
        results.review_issues.push({
          pr: prNum,
          title: prTitle,
          url: prUrl,
          head_branch: headBranch,
          author: prAuthor,
          review_status: reviewInfo.status,
          reviewers: reviewInfo.reviewers,
          approved_count: reviewInfo.approved_count,
          changes_requested_count: reviewInfo.changes_requested_count,
          pending_count: reviewInfo.pending_count
        });
        hasIssues = true;
      }

      // 3. PR age/staleness tracking
      const prDetail = await this.getPRDetail(repo, prNum);
      const ageInfo = this.computePRAge(prDetail || pr);
      if (['stale', 'abandoned'].includes(ageInfo.staleness)) {
        results.stale_prs.push({
          pr: prNum,
          title: prTitle,
          url: prUrl,
          head_branch: headBranch,
          author: prAuthor,
          days_open: ageInfo.days_open,
          days_since_update: ageInfo.days_since_update,
          staleness: ageInfo.staleness
        });
        hasIssues = true;
      }

      // 4. PR size analysis
      if (['large', 'xl'].includes(ageInfo.size)) {
        results.oversized_prs.push({
          pr: prNum,
          title: prTitle,
          url: prUrl,
          head_branch: headBranch,
          author: prAuthor,
          additions: ageInfo.additions,
          deletions: ageInfo.deletions,
          total_changes: ageInfo.total_changes,
          size: ageInfo.size
        });
        hasIssues = true;
      }

      if (!hasIssues) {
        results.healthy_prs++;
      }
    }

    // 5. CI failure scanning
    results.workflow_failures = await this.scanWorkflowFailures(repo);

    return results;
  }

  public async scanAllRepos(): Promise<ScanResult[]> {
    const allResults: ScanResult[] = [];
    for (const repo of this.repos) {
      console.log(`Scanning ${repo}...`);
      const result = await this.scanRepository(repo);
      allResults.push(result);
      const liveAgents = await this.getLiveAgentsForRepo(repo);
      const mentionTargets = liveAgents.length > 0 ? liveAgents : [this.assignee];
      const mentionText = mentionTargets.map((login) => `@${login}`).join(' ');

      // Create GitHub issues for conflicts
      for (const cp of result.conflicting_prs) {
        const title = `🚨 Merge conflict in PR #${cp.pr}`;
        const body = `${mentionText} merge conflict detected.\n\nBranch \`${cp.head_branch}\` conflicts with base.\n\nPR: ${cp.url}`;
        await this.createIssue(repo, title, body, ['needs-fix', 'merge-conflict']);

        if (this.autoLabelConflict) {
          await this.addLabel(repo, cp.pr, 'needs-fix');
        }
      }

      // Create GitHub issues for workflow failures
      for (const f of result.workflow_failures) {
        const title = `⚠️ Workflow '${f.name}' failed on ${f.branch}`;
        let body = `${mentionText} please investigate: ${f.html_url}`;
        if (this.tagAuthorOnFail && f.author) {
          body = `@${f.author} ${mentionText} please investigate: ${f.html_url}`;
        }
        await this.createIssue(repo, title, body, ['needs-fix', 'ci-failure']);
      }
    }
    return allResults;
  }
}

// ── Real Webhook notifications helper ─────────────────────────────────────────
async function dispatchWebhookNotification(
  webhookUrl: string,
  service: 'slack' | 'discord',
  issueType: string,
  title: string,
  repo: string,
  url: string,
  author = 'Unknown'
): Promise<boolean> {
  const isSlack = service === 'slack';
  if (isSlack && !webhookUrl.startsWith('https://hooks.slack.com/')) return false;
  if (!isSlack && !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return false;

  const colorHex = issueType === 'merge_conflict' ? '#f59e0b' : '#ef4444';
  const colorNum = issueType === 'merge_conflict' ? 0xF59E0B : 0xEF4444;
  const typeLabel = issueType === 'merge_conflict' ? '🔀 Merge Conflict' : '❌ CI Failure';

  const payload: any = isSlack
    ? {
        attachments: [
          {
            color: colorHex,
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: `Bob PR Health Alert`, emoji: true }
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Type:*\n${typeLabel}` },
                  { type: 'mrkdwn', text: `*Repository:*\n\`${repo}\`` },
                  { type: 'mrkdwn', text: `*Author:*\n@${author}` },
                  { type: 'mrkdwn', text: `*Title:*\n${title}` }
                ]
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View on GitHub' },
                    url: url,
                    style: 'primary'
                  }
                ]
              }
            ]
          }
        ]
      }
    : {
        username: 'Bob PR Health',
        embeds: [
          {
            title: `PR Health Alert — ${typeLabel}`,
            color: colorNum,
            fields: [
              { name: 'Repository', value: `\`${repo}\``, inline: true },
              { name: 'Author', value: `@${author}`, inline: true },
              { name: 'Issue', value: title, inline: false }
            ],
            url: url,
            footer: { text: 'Bob PR Health Scanner' }
          }
        ]
      };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (error) {
    console.error(`Failed to send ${service} notification:`, error);
    return false;
  }
}

// ── Auto Comment Logic ────────────────────────────────────────────────────────
async function triggerAutoComment(issue: any, scanner: PRHealthScanner) {
  if (!issue.pr_number) return;

  // Anti-spam cooldown: Only 1 comment per 1 hour per issue
  if (issue.last_commented_at) {
    const deltaMs = Date.now() - new Date(issue.last_commented_at).getTime();
    if (deltaMs < 3600 * 1000) return;
  }

  // Anti-spam cap: Max 3 comments
  if (issue.comment_count >= 3) return;

  // Check write access
  const ur = await get(
    'SELECT * FROM user_repos WHERE user_id = $1 AND full_name = $2',
    [issue.user_id, issue.repo]
  );
  if (!ur || !['write', 'admin'].includes(ur.agent_permission)) {
    return;
  }

  const commentCount = issue.comment_count || 0;
  const msg =
    `🤖 **Bob PR Health Alert**\n\n` +
    `Hey @${scanner.assignee}, I've detected a **${issue.issue_type.replace('_', ' ')}** on this PR.\n` +
    `You can track the resolution progress on the [Bob Dashboard](${process.env.PUBLIC_BASE_URL || ''}).\n\n` +
    `*Status: Flagged for attention (Reminder #${commentCount + 1})*`;

  console.log(`Auto-commenting on ${issue.repo}#${issue.pr_number} (Count: ${commentCount})`);
  const resp = await scanner.createComment(issue.repo, issue.pr_number, msg);

  if (resp && (resp.id || resp.url)) {
    await run(
      'UPDATE pr_issues SET last_commented_at = $1, comment_count = $2, updated_at = $3 WHERE id = $4',
      [new Date().toISOString(), commentCount + 1, new Date().toISOString(), issue.id]
    );
  }
}

function isWebhookReason(reason: string): boolean {
  return reason.startsWith('webhook:') || reason.startsWith('pull_request:') || reason.startsWith('check_suite:') || reason.startsWith('pull_request_review:');
}

async function getPrStateByRepo(userId: number, repo: string): Promise<Map<number, PrScanStateRow>> {
  const rows = await query<PrScanStateRow>(
    'SELECT pr_number, head_sha, last_scanned_at FROM pr_scan_state WHERE user_id = $1 AND repo = $2',
    [userId, repo]
  );
  const map = new Map<number, PrScanStateRow>();
  for (const row of rows) {
    map.set(Number(row.pr_number), row);
  }
  return map;
}

async function getUnresolvedIssueTypesByPr(userId: number, repo: string): Promise<Map<number, Set<string>>> {
  const rows = await query<{ pr_number: number; issue_type: string }>(
    `SELECT pr_number, issue_type
     FROM pr_issues
     WHERE user_id = $1
       AND repo = $2
       AND pr_number IS NOT NULL
       AND status IN ($3, $4, $5)`,
    [userId, repo, 'pending', 'in_progress', 'failed']
  );

  const map = new Map<number, Set<string>>();
  for (const row of rows) {
    const prNumber = Number(row.pr_number);
    const issueType = String(row.issue_type || '');
    const set = map.get(prNumber) || new Set<string>();
    if (issueType) set.add(issueType);
    map.set(prNumber, set);
  }
  return map;
}

async function syncPrScanState(
  userId: number,
  repo: string,
  prHeads: Array<{ pr: number; head_sha: string }>,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  for (const item of prHeads) {
    await run(
      `INSERT INTO pr_scan_state (user_id, repo, pr_number, head_sha, last_scanned_at, last_scan_reason, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, repo, pr_number) DO UPDATE
       SET head_sha = excluded.head_sha,
           last_scanned_at = excluded.last_scanned_at,
           last_scan_reason = excluded.last_scan_reason,
           updated_at = excluded.updated_at`,
      [userId, repo, item.pr, item.head_sha || null, now, reason, now]
    );
  }

  const openNumbers = new Set<number>(prHeads.map((p) => Number(p.pr)));
  const existing = await query<{ pr_number: number }>(
    'SELECT pr_number FROM pr_scan_state WHERE user_id = $1 AND repo = $2',
    [userId, repo]
  );
  for (const row of existing) {
    const prNumber = Number(row.pr_number);
    if (!openNumbers.has(prNumber)) {
      await run(
        'DELETE FROM pr_scan_state WHERE user_id = $1 AND repo = $2 AND pr_number = $3',
        [userId, repo, prNumber]
      );
    }
  }
}

async function shouldSkipRepoByDebounce(userId: number, repo: string, reason: string): Promise<boolean> {
  if (!isWebhookReason(reason)) return false;
  const row = await get<{ last_scanned_at?: string | null }>(
    'SELECT MAX(last_scanned_at) AS last_scanned_at FROM pr_scan_state WHERE user_id = $1 AND repo = $2',
    [userId, repo]
  );
  if (!row?.last_scanned_at) return false;
  const last = new Date(row.last_scanned_at).getTime();
  if (!Number.isFinite(last)) return false;
  return Date.now() - last < DEFAULT_WEBHOOK_REPO_DEBOUNCE_MS;
}

async function createRepoTrackerIssues(
  scanner: PRHealthScanner,
  repo: string,
  result: ScanResult,
  tagAuthorOnFail: boolean,
  autoLabelConflict: boolean
): Promise<void> {
  if (result.conflicting_prs.length === 0 && result.workflow_failures.length === 0) return;

  const liveAgents = await scanner.getLiveAgentsForRepo(repo);
  const mentionTargets = liveAgents.length > 0 ? liveAgents : [scanner.assignee];
  const mentionText = mentionTargets.map((login) => `@${login}`).join(' ');

  for (const cp of result.conflicting_prs) {
    const title = `🚨 Merge conflict in PR #${cp.pr}`;
    const body = `${mentionText} merge conflict detected.\n\nBranch \`${cp.head_branch}\` conflicts with base.\n\nPR: ${cp.url}`;
    await scanner.createIssue(repo, title, body, ['needs-fix', 'merge-conflict']);
    if (autoLabelConflict) {
      await scanner.addLabel(repo, cp.pr, 'needs-fix');
    }
  }

  for (const f of result.workflow_failures) {
    const title = `⚠️ Workflow '${f.name}' failed on ${f.branch}`;
    let body = `${mentionText} please investigate: ${f.html_url}`;
    if (tagAuthorOnFail && f.author) {
      body = `@${f.author} ${mentionText} please investigate: ${f.html_url}`;
    }
    await scanner.createIssue(repo, title, body, ['needs-fix', 'ci-failure']);
  }
}

// ── Real Scan Orchestration and Ingestion ────────────────────────────────────
export async function runScanForUser(
  userId: number,
  socketEmitter?: (room: string, event: string, data: any) => void,
  options: RunScanOptions = {}
): Promise<void> {
  const user = await get('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) return;

  const decryptedToken = decryptToken(user.access_token);
  if (!decryptedToken) {
    console.error(`Unable to decrypt token for user ${user.username}.`);
    return;
  }

  const settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
  const excludedRepos = settings?.excluded_repos
    ? settings.excluded_repos.split(',').map((r: string) => r.trim()).filter(Boolean)
    : [];

  const userRepos = await query('SELECT * FROM user_repos WHERE user_id = $1', [userId]);
  const scanRepos = userRepos
    .map(ur => ur.full_name)
    .filter(name => !excludedRepos.includes(name));

  if (scanRepos.length === 0) {
    console.log(`No active repos to scan for user ${user.username}`);
    return;
  }

  const reason = options.reason || 'manual';
  let selectedRepos = scanRepos;
  if (Array.isArray(options.repos) && options.repos.length > 0) {
    const allowed = new Set(scanRepos);
    selectedRepos = options.repos.filter((repo) => allowed.has(repo));
  }

  if (selectedRepos.length === 0) {
    return;
  }

  const assignee = process.env.ASSIGNEE_USERNAME || user.username || 'jules';
  const autoLabelConflict = settings ? settings.auto_label_conflict === 1 || settings.auto_label_conflict === true : true;
  const tagAuthorOnFail = settings ? settings.tag_author_on_fail === 1 || settings.tag_author_on_fail === true : false;

  // Read via user token, write (create issue/comment/label) via bot token when configured.
  const readScanner = new PRHealthScanner(
    decryptedToken,
    selectedRepos,
    assignee,
    autoLabelConflict,
    tagAuthorOnFail
  );

  const writeToken = resolveWriteToken(decryptedToken);
  const writeScanner = new PRHealthScanner(
    writeToken,
    selectedRepos,
    assignee,
    autoLabelConflict,
    tagAuthorOnFail
  );

  const results: ScanResult[] = [];
  const newIssues: any[] = [];

  for (const repoFullName of selectedRepos) {
    if (!options.force) {
      const skip = await shouldSkipRepoByDebounce(userId, repoFullName, reason);
      if (skip) {
        continue;
      }
    }

    const prStateByNumber = await getPrStateByRepo(userId, repoFullName);
    const unresolvedIssueTypesByPr = await getUnresolvedIssueTypesByPr(userId, repoFullName);
    const res = await readScanner.scanRepository(repoFullName, {
      prStateByNumber,
      unresolvedIssueTypesByPr,
      scanFreshnessMs: DEFAULT_PR_SCAN_FRESHNESS_MS,
      force: !!options.force
    });

    results.push(res);
    await syncPrScanState(userId, repoFullName, res.pr_heads, reason);

    // Only create repo tracker issues when we have at least one new finding in DB later in this loop.
    let repoHasNewTrackerIssue = false;

    const repo = res.repo;

    // 1. Conflicts
    for (const pr of res.conflicting_prs) {
      const key = `${repo}#${pr.pr}`;
      let issue = await get('SELECT * FROM pr_issues WHERE user_id = $1 AND issue_key = $2', [userId, key]);
      if (!issue) {
        const insertRes = await run(
          'INSERT INTO pr_issues (user_id, repo, issue_key, title, url, pr_number, branch, issue_type, status, author, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
          [
            userId,
            repo,
            key,
            pr.title,
            pr.url,
            pr.pr,
            pr.head_branch,
            'merge_conflict',
            'pending',
            pr.author,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        issue = {
          id: insertRes.lastInsertRowId,
          user_id: userId,
          repo,
          issue_key: key,
          pr_number: pr.pr,
          issue_type: 'merge_conflict',
          comment_count: 0
        };
        newIssues.push({ ...pr, id: issue.id, repo, issue_type: 'merge_conflict' });
        repoHasNewTrackerIssue = true;
      }

      if (issue && issue.status === 'pending') {
        await triggerAutoComment(issue, writeScanner);
      }
    }

    // 2. CI Failures
    for (const f of res.workflow_failures) {
      const key = `${repo}#run${f.id}`;
      let issue = await get('SELECT * FROM pr_issues WHERE user_id = $1 AND issue_key = $2', [userId, key]);
      if (!issue) {
        const title = `CI: ${f.name} failed on ${f.branch}`;
        const insertRes = await run(
          'INSERT INTO pr_issues (user_id, repo, issue_key, title, url, run_id, branch, issue_type, status, author, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
          [
            userId,
            repo,
            key,
            title,
            f.html_url,
            String(f.id),
            f.branch,
            'ci_failure',
            'pending',
            f.author,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        newIssues.push({ title, repo, url: f.html_url, author: f.author, issue_type: 'ci_failure' });
        repoHasNewTrackerIssue = true;
      }
    }

    // 3. Review issues
    for (const ri of res.review_issues) {
      const key = `${repo}#review${ri.pr}`;
      let issue = await get('SELECT * FROM pr_issues WHERE user_id = $1 AND issue_key = $2', [userId, key]);
      if (!issue) {
        const title = `Changes requested on PR #${ri.pr}: ${ri.title}`;
        await run(
          'INSERT INTO pr_issues (user_id, repo, issue_key, title, url, pr_number, branch, issue_type, status, author, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [
            userId,
            repo,
            key,
            title,
            ri.url,
            ri.pr,
            ri.head_branch,
            'review_issue',
            'pending',
            ri.author,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        newIssues.push({ title, repo, url: ri.url, author: ri.author, issue_type: 'review_issue' });
      }
    }

    // 4. Stale PRs
    for (const sp of res.stale_prs) {
      const key = `${repo}#stale${sp.pr}`;
      let issue = await get('SELECT * FROM pr_issues WHERE user_id = $1 AND issue_key = $2', [userId, key]);
      if (!issue) {
        const title = `Stale PR #${sp.pr} (${sp.days_since_update}d idle): ${sp.title}`;
        await run(
          'INSERT INTO pr_issues (user_id, repo, issue_key, title, url, pr_number, branch, issue_type, status, author, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [
            userId,
            repo,
            key,
            title,
            sp.url,
            sp.pr,
            sp.head_branch,
            'stale_pr',
            'pending',
            sp.author,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        newIssues.push({ title, repo, url: sp.url, author: sp.author, issue_type: 'stale_pr' });
      }
    }

    // 5. Oversized PRs
    for (const op of res.oversized_prs) {
      const key = `${repo}#size${op.pr}`;
      let issue = await get('SELECT * FROM pr_issues WHERE user_id = $1 AND issue_key = $2', [userId, key]);
      if (!issue) {
        const title = `Large PR #${op.pr} (${op.total_changes} lines): ${op.title}`;
        await run(
          'INSERT INTO pr_issues (user_id, repo, issue_key, title, url, pr_number, branch, issue_type, status, author, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [
            userId,
            repo,
            key,
            title,
            op.url,
            op.pr,
            op.head_branch,
            'oversized_pr',
            'pending',
            op.author,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        newIssues.push({ title, repo, url: op.url, author: op.author, issue_type: 'oversized_pr' });
      }
    }

    if (repoHasNewTrackerIssue) {
      await createRepoTrackerIssues(
        writeScanner,
        repo,
        {
          ...res,
          conflicting_prs: res.conflicting_prs,
          workflow_failures: res.workflow_failures
        },
        settings ? settings.tag_author_on_fail === 1 || settings.tag_author_on_fail === true : false,
        settings ? settings.auto_label_conflict === 1 || settings.auto_label_conflict === true : true
      );
    }
  }

  // Dispatch Webhook Notifications
  if (newIssues.length > 0 && settings) {
    for (const issue of newIssues) {
      if (settings.slack_webhook) {
        await dispatchWebhookNotification(
          settings.slack_webhook,
          'slack',
          issue.issue_type,
          issue.title,
          issue.repo,
          issue.url,
          issue.author
        );
      }
      if (settings.discord_webhook) {
        await dispatchWebhookNotification(
          settings.discord_webhook,
          'discord',
          issue.issue_type,
          issue.title,
          issue.repo,
          issue.url,
          issue.author
        );
      }
    }
  }

  // Notify clients via WebSocket
  if (socketEmitter) {
    const updatedData = await getUserDashboardData(userId);
    socketEmitter(user.username, 'update', updatedData);
    socketEmitter(user.username, 'scan_complete', { status: 'success' });
  }
}

// Helper to construct complete dashboard payload matching frontend requirements
export async function getUserDashboardData(userId: number): Promise<any> {
  const issues = await query(
    'SELECT * FROM pr_issues WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  
  const byStatus: Record<string, any[]> = {
    pending: [],
    in_progress: [],
    failed: [],
    resolved: []
  };

  let conflicts = 0;
  let failing = 0;
  let reviewIssues = 0;
  let stale = 0;
  let oversized = 0;

  for (const i of issues) {
    const item = {
      id: i.id,
      repo: i.repo,
      issue_key: i.issue_key,
      title: i.title,
      url: i.url,
      branch: i.branch,
      pr_number: i.pr_number,
      run_id: i.run_id,
      type: i.issue_type,
      status: i.status,
      author: i.author,
      last_commented_at: i.last_commented_at,
      comment_count: i.comment_count,
      created_at: i.created_at,
      updated_at: i.updated_at
    };

    if (byStatus[i.status]) {
      byStatus[i.status].push(item);
    } else {
      byStatus.pending.push(item);
    }

    if (i.status === 'pending') {
      if (i.issue_type === 'merge_conflict') conflicts++;
      if (i.issue_type === 'ci_failure') failing++;
      if (i.issue_type === 'review_issue') reviewIssues++;
      if (i.issue_type === 'stale_pr') stale++;
      if (i.issue_type === 'oversized_pr') oversized++;
    }
  }

  const userRepos = await query('SELECT * FROM user_repos WHERE user_id = $1', [userId]);
  const settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
  const excluded = settings?.excluded_repos
    ? settings.excluded_repos.split(',').map((r: string) => r.trim()).filter(Boolean)
    : [];

  const repos = userRepos.map(ur => ({
    full_name: ur.full_name,
    private: ur.private === 1 || ur.private === true,
    url: ur.url,
    language: ur.language,
    permissions_level: ur.permissions_level,
    agent_permission: ur.agent_permission,
    archived: ur.archived === 1 || ur.archived === true,
    fork: ur.fork === 1 || ur.fork === true,
    last_synced: ur.last_synced,
    is_active: !excluded.includes(ur.full_name)
  }));

  const total = issues.length;
  const ready = total - (conflicts + failing + reviewIssues + stale + oversized);

  return {
    stats: {
      total,
      pending: byStatus.pending.length,
      in_progress: byStatus.in_progress.length,
      failed: byStatus.failed.length,
      resolved: byStatus.resolved.length,
      conflicts,
      failing,
      review_issues: reviewIssues,
      stale,
      oversized,
      ready
    },
    pending: byStatus.pending,
    in_progress: byStatus.in_progress,
    failed: byStatus.failed,
    resolved: byStatus.resolved,
    repos
  };
}

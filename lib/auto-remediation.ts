export const GITHUB_API = 'https://api.github.com';

async function fetchGitHub(url: string, token: string, method = 'GET', body?: any): Promise<any> {
  const headers: Record<string, string> = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Bob-PR-Health-Scanner'
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Phase 7: Micro-delays for Secondary Abuse Limits
  await new Promise(r => setTimeout(r, 200));

  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  // Phase 7: Primary Rate Limit Interception
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '999', 10);
  if (remaining < 10) {
    const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10);
    const waitMs = Math.max(0, (resetAt * 1000) - Date.now()) + 5000;
    console.warn(`GitHub Rate limit low (${remaining}), waiting ${Math.round(waitMs / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  // Graceful degradation on 403 / 429
  if (response.status === 403 || response.status === 429) {
    console.warn(`Caught ${response.status}. Graceful degradation.`);
    if ((global as any).socketEmitter) {
      try {
        (global as any).socketEmitter('global', 'rate_limit_paused', { resume_at: Date.now() + 60000 });
      } catch (e) {}
    }
  }

  if (response.status === 204) {
    return { success: true };
  }

  if (!response.ok) {
    const errText = await response.text();
    return { error: `HTTP ${response.status}: ${errText}` };
  }

  return await response.json();
}

export async function createTrackingIssue(repo: string, failureDetails: any, token: string): Promise<any> {
  const agents = process.env.REMEDIATION_AGENTS || 'jules,codex';
  const mentions = agents.split(',').map(a => `@${a.trim()}`).join(' ');

  const title = `🚨 Auto-Remediation: Fix ${failureDetails.type || 'Failure'} in ${failureDetails.branch || 'branch'}`;
  const body = `${mentions} Action required!

A failure has been detected. Please investigate and push a fix.

**Details:**
\`\`\`
${failureDetails.snippet || 'No error snippet available.'}
\`\`\`

**Original PR/Branch:** ${failureDetails.branch || 'unknown'}
`;

  return await fetchGitHub(`${GITHUB_API}/repos/${repo}/issues`, token, 'POST', {
    title,
    body,
    labels: ['needs-fix', 'auto-remediation']
  });
}

export async function createDraftPR(repo: string, issueNumber: number, headBranch: string, token: string): Promise<any> {
  const title = `Draft PR for Issue #${issueNumber}`;
  const body = `This draft PR addresses the failures outlined in tracking issue #${issueNumber}.

Closes #${issueNumber}`;

  return await fetchGitHub(`${GITHUB_API}/repos/${repo}/pulls`, token, 'POST', {
    title,
    body,
    head: headBranch,
    base: 'main',
    draft: true
  });
}

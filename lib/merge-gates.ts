/**
 * Merge Checklist Gates & Squash-Merge API
 * 
 * Provides functionality to:
 * 1. Validate merge prerequisites (checklist gates)
 * 2. Execute squash-and-merge operations directly from the dashboard
 * 3. Track merge approval contracts
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { get, query, run } from '@/lib/db';
import { decryptToken } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';

export interface MergeChecklistItem {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
  description?: string;
}

export interface MergeApprovalContract {
  repo: string;
  prNumber: number;
  checklist: MergeChecklistItem[];
  approvedBy: string[];
  approvedAt?: string;
  mergeMethod: 'merge' | 'squash' | 'rebase';
  autoDeleteBranch: boolean;
}

const GITHUB_API = 'https://api.github.com';

async function githubRequest(
  token: string,
  url: string,
  method = 'GET',
  body?: any
): Promise<any> {
  const headers: Record<string, string> = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Bob-Merge-Gates'
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

    // Handle rate limiting
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '999', 10);
    if (remaining < 10) {
      const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10);
      const waitMs = Math.max(0, (resetAt * 1000) - Date.now()) + 2000;
      console.warn(`GitHub Rate limit low (${remaining}), waiting ${Math.round(waitMs / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    if (!response.ok) {
      const errText = await response.text();
      return { error: `HTTP ${response.status}: ${errText}` };
    }

    if (response.status === 204 || response.status === 201) {
      return { success: true };
    }

    return await response.json();
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Get default merge checklist template
 */
export function getDefaultChecklist(): MergeChecklistItem[] {
  return [
    {
      id: 'ci_passing',
      label: 'CI/CD Passing',
      required: true,
      checked: false,
      description: 'All workflow runs must be successful'
    },
    {
      id: 'review_approved',
      label: 'Code Review Approved',
      required: true,
      checked: false,
      description: 'At least one approved review from a collaborator'
    },
    {
      id: 'no_conflicts',
      label: 'No Merge Conflicts',
      required: true,
      checked: false,
      description: 'PR branch is mergeable with base branch'
    },
    {
      id: 'changes_tested',
      label: 'Changes Tested',
      required: false,
      checked: false,
      description: 'Developer has verified changes locally'
    },
    {
      id: 'docs_updated',
      label: 'Documentation Updated',
      required: false,
      checked: false,
      description: 'Relevant documentation has been updated'
    },
    {
      id: 'security_review',
      label: 'Security Review',
      required: false,
      checked: false,
      description: 'Security implications have been considered'
    }
  ];
}

/**
 * Validate PR against checklist gates
 */
export async function validateMergeGates(
  token: string,
  repo: string,
  prNumber: number
): Promise<{ valid: boolean; gates: MergeChecklistItem[]; blocking: string[] }> {
  const checklist = getDefaultChecklist();
  const blocking: string[] = [];

  try {
    // Fetch PR details
    const prResponse = await githubRequest(
      token,
      `${GITHUB_API}/repos/${repo}/pulls/${prNumber}`
    );

    if (prResponse.error) {
      return { valid: false, gates: checklist, blocking: ['Unable to fetch PR details'] };
    }

    const pr = prResponse;

    // Check CI status
    const checksResponse = await githubRequest(
      token,
      `${GITHUB_API}/repos/${repo}/commits/${pr.head.sha}/check-runs`
    );

    let ciPassing = true;
    if (checksResponse.check_runs && Array.isArray(checksResponse.check_runs)) {
      const failedChecks = checksResponse.check_runs.filter(
        (c: any) => c.conclusion === 'failure' || c.conclusion === 'cancelled'
      );
      if (failedChecks.length > 0) {
        ciPassing = false;
        blocking.push(`${failedChecks.length} check(s) failing`);
      }
    }

    // Update CI gate
    const ciGate = checklist.find(g => g.id === 'ci_passing');
    if (ciGate) {
      ciGate.checked = ciPassing;
    }

    // Check reviews
    const reviewsResponse = await githubRequest(
      token,
      `${GITHUB_API}/repos/${repo}/pulls/${prNumber}/reviews`
    );

    let reviewApproved = false;
    if (Array.isArray(reviewsResponse)) {
      reviewApproved = reviewsResponse.some((r: any) => r.state === 'APPROVED');
      if (!reviewApproved) {
        blocking.push('No approved reviews');
      }
    }

    const reviewGate = checklist.find(g => g.id === 'review_approved');
    if (reviewGate) {
      reviewGate.checked = reviewApproved;
    }

    // Check merge conflicts
    const noConflicts = pr.mergeable !== false;
    if (!noConflicts) {
      blocking.push('Merge conflicts detected');
    }

    const conflictsGate = checklist.find(g => g.id === 'no_conflicts');
    if (conflictsGate) {
      conflictsGate.checked = noConflicts;
    }

    return {
      valid: blocking.length === 0,
      gates: checklist,
      blocking
    };
  } catch (error: any) {
    console.error('Merge gate validation error:', error);
    return {
      valid: false,
      gates: checklist,
      blocking: [error.message || 'Validation failed']
    };
  }
}

/**
 * Execute squash merge
 */
export async function executeSquashMerge(
  token: string,
  repo: string,
  prNumber: number,
  commitTitle?: string,
  commitMessage?: string,
  autoDeleteBranch = true
): Promise<{ success: boolean; mergeSha?: string; error?: string }> {
  try {
    const mergeUrl = `${GITHUB_API}/repos/${repo}/pulls/${prNumber}/merge`;
    
    const body: any = {
      merge_method: 'squash',
      delete_head_branch: autoDeleteBranch
    };

    if (commitTitle) {
      body.commit_title = commitTitle;
    }

    if (commitMessage) {
      body.commit_message = commitMessage;
    }

    const result = await githubRequest(token, mergeUrl, 'PUT', body);

    if (result.error) {
      return { success: false, error: result.error };
    }

    // Delete source branch if requested and not already done
    if (autoDeleteBranch) {
      try {
        const prDetails = await githubRequest(token, `${GITHUB_API}/repos/${repo}/pulls/${prNumber}`);
        const branchName = prDetails.head?.ref;
        
        if (branchName) {
          await githubRequest(
            token,
            `${GITHUB_API}/repos/${repo}/git/refs/heads/${branchName}`,
            'DELETE'
          );
        }
      } catch (err) {
        console.warn('Failed to delete source branch:', err);
      }
    }

    return {
      success: true,
      mergeSha: result.sha
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/merge-gates/validate
 * Validate merge prerequisites for a PR
 */
export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const { repo, prNumber } = await request.json();

    if (!repo || typeof prNumber !== 'number') {
      return NextResponse.json(
        { error: 'Missing repo or prNumber' },
        { status: 400 }
      );
    }

    // Get user's GitHub token
    const user = await get('SELECT * FROM users WHERE id = $1', [sessionUser.db_id]);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const decryptedToken = decryptToken(user.access_token);
    if (!decryptedToken) {
      return NextResponse.json({ error: 'Unable to decrypt token' }, { status: 500 });
    }

    // Validate merge gates
    const result = await validateMergeGates(decryptedToken, repo, prNumber);

    // Save/approve contract if all gates pass
    if (result.valid) {
      const now = new Date().toISOString();
      await run(
        `INSERT INTO merge_contracts (user_id, repo, pr_number, checklist_json, approved_by, approved_at, merge_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (repo, pr_number) DO UPDATE SET
           checklist_json = $4,
           approved_by = $5,
           approved_at = $6,
           merge_method = $7`,
        [
          sessionUser.db_id,
          repo,
          prNumber,
          JSON.stringify(result.gates),
          JSON.stringify([sessionUser.username]),
          now,
          'squash'
        ]
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Merge gate validation error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/merge-gates/execute
 * Execute squash-and-merge operation
 */
export async function executeMergeHandler(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const { repo, prNumber, commitTitle, commitMessage, autoDeleteBranch, skipValidation } = await request.json();

    if (!repo || typeof prNumber !== 'number') {
      return NextResponse.json(
        { error: 'Missing repo or prNumber' },
        { status: 400 }
      );
    }

    // Get user's GitHub token
    const user = await get('SELECT * FROM users WHERE id = $1', [sessionUser.db_id]);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const decryptedToken = decryptToken(user.access_token);
    if (!decryptedToken) {
      return NextResponse.json({ error: 'Unable to decrypt token' }, { status: 500 });
    }

    // Validate gates unless explicitly skipped
    if (!skipValidation) {
      const validation = await validateMergeGates(decryptedToken, repo, prNumber);
      
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Merge gates not satisfied',
            blocking: validation.blocking,
            gates: validation.gates
          },
          { status: 400 }
        );
      }
    }

    // Check for existing approved contract
    const contract = await get(
      'SELECT * FROM merge_contracts WHERE repo = $1 AND pr_number = $2',
      [repo, prNumber]
    );

    if (!contract && !skipValidation) {
      return NextResponse.json(
        { error: 'No approved merge contract found. Please validate gates first.' },
        { status: 400 }
      );
    }

    // Execute merge
    const result = await executeSquashMerge(
      decryptedToken,
      repo,
      prNumber,
      commitTitle,
      commitMessage,
      autoDeleteBranch !== false
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Merge execution failed', message: result.error },
        { status: 500 }
      );
    }

    // Log the merge action
    await run(
      'INSERT INTO merge_logs (user_id, repo, pr_number, merge_sha, merged_at, merge_method) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        sessionUser.db_id,
        repo,
        prNumber,
        result.mergeSha,
        new Date().toISOString(),
        'squash'
      ]
    );

    // Update contract status
    if (contract) {
      await run(
        'UPDATE merge_contracts SET merged = 1, merged_at = $1 WHERE repo = $2 AND pr_number = $3',
        [new Date().toISOString(), repo, prNumber]
      );
    }

    return NextResponse.json({
      success: true,
      mergeSha: result.mergeSha,
      message: 'Successfully merged PR'
    });
  } catch (error: any) {
    console.error('Merge execution error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/merge-gates/:repo/:prNumber
 * Get merge contract status for a PR
 */
export async function getMergeContract(repo: string, prNumber: number) {
  try {
    const contract = await get(
      'SELECT * FROM merge_contracts WHERE repo = $1 AND pr_number = $2',
      [repo, prNumber]
    );

    if (!contract) {
      return { contract: null, gates: getDefaultChecklist() };
    }

    const checklist = contract.checklist_json
      ? JSON.parse(contract.checklist_json) as MergeChecklistItem[]
      : getDefaultChecklist();

    return {
      contract: {
        ...contract,
        checklist,
        approved_by: contract.approved_by ? JSON.parse(contract.approved_by) : []
      },
      gates: checklist
    };
  } catch (error: any) {
    console.error('Get merge contract error:', error);
    return { contract: null, gates: getDefaultChecklist(), error: error.message };
  }
}

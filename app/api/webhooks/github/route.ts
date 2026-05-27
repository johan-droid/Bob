import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { get, query, run } from '@/lib/db';
import { getUserDashboardData } from '@/lib/scanner';

async function emitToRepoOwners(repoFullName: string) {
  try {
    const userRepos = await query('SELECT user_id FROM user_repos WHERE full_name = $1', [repoFullName]);
    for (const ur of userRepos) {
      const user = await get('SELECT username FROM users WHERE id = $1', [ur.user_id]);
      if (user && (global as any).socketEmitter) {
        const dashboardData = await getUserDashboardData(ur.user_id);
        (global as any).socketEmitter(user.username, 'update', dashboardData);
      }
    }
  } catch (err) {
    console.error(`Failed to emit webhook updates for repo ${repoFullName}:`, err);
  }
}

async function webhookResolvePr(repoFullName: string, prNumber: number) {
  const key = `${repoFullName}#${prNumber}`;
  const now = new Date().toISOString();
  await run(
    'UPDATE pr_issues SET status = $1, updated_at = $2 WHERE repo = $3 AND issue_key = $4',
    ['resolved', now, repoFullName, key]
  );
  await emitToRepoOwners(repoFullName);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.WEBHOOK_SECRET || '';
  const allowUnsigned = process.env.ALLOW_UNSIGNED_WEBHOOKS === '1';
  
  const signature = request.headers.get('X-Hub-Signature-256') || '';
  const event = request.headers.get('X-GitHub-Event') || '';
  
  const bodyText = await request.text();
  
  if (webhookSecret) {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyText)
      .digest('hex');
      
    if (signature !== expected) {
      console.warn('Webhook signature mismatch');
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 403 });
    }
  } else if (!allowUnsigned) {
    console.warn('Rejected unsigned GitHub webhook because WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Unsigned webhooks not allowed' }, { status: 403 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(bodyText);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const repoName = payload.repository?.full_name || '';
  console.log(`Webhook: ${event} -> ${repoName}`);

  try {
    if (event === 'pull_request') {
      const action = payload.action;
      const pr = payload.pull_request || {};
      if (action === 'closed' && pr.merged) {
        await webhookResolvePr(repoName, pr.number);
      }
    } else if (event === 'check_suite') {
      const cs = payload.check_suite || {};
      if (cs.conclusion === 'failure') {
        await emitToRepoOwners(repoName);
      }
    } else if (event === 'installation' || event === 'installation_repositories') {
      const action = payload.action;
      const repos = payload.repositories || payload.repositories_added || [];
      const reposRemoved = payload.repositories_removed || [];
      
      const added = repos.map((r: any) => r.full_name).filter(Boolean);
      const removed = reposRemoved.map((r: any) => r.full_name).filter(Boolean);
      
      console.log(`Webhook Installation (${action}) — added: ${added.join(',')}, removed: ${removed.join(',')}`);

      for (const full of added) {
        try {
          const owner = full.split('/')[0];
          const users = await query('SELECT id, username FROM users WHERE username = $1', [owner]);
          for (const u of users) {
            const existing = await get('SELECT id FROM user_repos WHERE user_id = $1 AND full_name = $2', [u.id, full]);
            if (!existing) {
              const now = new Date().toISOString();
              await run(
                'INSERT INTO user_repos (user_id, full_name, private, url, language, permissions_level, agent_permission, archived, fork, last_synced) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [u.id, full, 0, `https://github.com/${full}`, 'Unknown', 'push', 'none', 0, 0, now]
              );
              console.log(`Registered repo ${full} for user ${u.username} via installation payload`);
            }
          }
          await emitToRepoOwners(full);
        } catch (err) {
          console.error(`Failed to register repo ${full} from installation webhook:`, err);
        }
      }

      for (const full of removed) {
        try {
          await run('DELETE FROM user_repos WHERE full_name = $1', [full]);
          console.log(`Removed repo entries for ${full} via installation_repositories payload`);
          await emitToRepoOwners(full);
        } catch (err) {
          console.error(`Failed to remove repo ${full} from installation webhook:`, err);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

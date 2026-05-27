import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { decryptToken } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { get, query } from '@/lib/db';

async function checkAndProvision(
  fullRepo: string,
  username: string,
  userToken: string,
  serverToken?: string
): Promise<any> {
  const base = { repo: fullRepo, url: `https://github.com/${fullRepo}` };

  try {
    const res = await fetch(`https://api.github.com/repos/${fullRepo}`, {
      headers: {
        'Authorization': `token ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Bob-PR-Health'
      }
    });

    if (res.status === 404) {
      return { ...base, status: 'error', message: 'Not found or no access' };
    }
    if (!res.ok) {
      return { ...base, status: 'error', message: `HTTP ${res.status}` };
    }

    const rd = await res.json();
    const perms = rd.permissions || {};
    const owner = rd.owner?.login || '';

    if (owner.toLowerCase() === username.toLowerCase()) {
      return { ...base, status: 'owner', message: 'You own this repository' };
    }
    if (perms.admin) {
      return { ...base, status: 'admin', message: 'Admin access confirmed' };
    }
    if (perms.push) {
      return { ...base, status: 'push', message: 'Write access confirmed' };
    }
    
    if (perms.pull && serverToken) {
      const [ownerName, repoName] = fullRepo.split('/');
      const inviteRes = await fetch(
        `https://api.github.com/repos/${ownerName}/${repoName}/collaborators/${username}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${serverToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Bob-PR-Health'
          },
          body: JSON.stringify({ permission: 'push' })
        }
      );

      if (inviteRes.status === 201) {
        return { ...base, status: 'invited', message: 'Invitation sent ✓' };
      }
      if ([204, 422].includes(inviteRes.status)) {
        return { ...base, status: 'push', message: 'Write access confirmed' };
      }
    }

    return { ...base, status: 'read', message: 'Read-only access' };
  } catch (err: any) {
    return { ...base, status: 'error', message: err.message };
  }
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const user = await get('SELECT * FROM users WHERE id = $1', [sessionUser.db_id]);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const token = decryptToken(user.access_token);
    if (!token) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const userRepos = await query('SELECT full_name FROM user_repos WHERE user_id = $1', [user.id]);
    const repos = userRepos.map(ur => ur.full_name);

    if (repos.length === 0) {
      return NextResponse.json({ all_provisioned: true, results: [] });
    }

    const serverToken = process.env.GITHUB_TOKEN;
    const results = await Promise.all(
      repos.map(r => checkAndProvision(r, user.username, token, serverToken))
    );

    const allOk = results.every(r => r.status !== 'error');
    return NextResponse.json({ all_provisioned: allOk, results });
  } catch (error: any) {
    console.error('Auto provision endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

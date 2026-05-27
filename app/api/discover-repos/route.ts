import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { decryptToken } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { get, query, run } from '@/lib/db';

function normalizeRepo(r: any, source: string) {
  return {
    full_name: r.full_name || '',
    name: r.name || '',
    private: r.private || false,
    url: r.html_url || '',
    description: r.description || '',
    language: r.language || 'Unknown',
    open_issues: r.open_issues_count || 0,
    stars: r.stargazers_count || 0,
    pushed_at: r.pushed_at || '',
    permissions: r.permissions || {},
    owner_login: r.owner?.login || '',
    fork: r.fork || false,
    archived: r.archived || false,
    source
  };
}

async function fetchAllPages(url: string, token: string, params: Record<string, string> = {}): Promise<any[]> {
  const list: any[] = [];
  let page = 1;
  while (true) {
    const urlObj = new URL(url);
    urlObj.searchParams.set('per_page', '100');
    urlObj.searchParams.set('page', String(page));
    for (const [k, v] of Object.entries(params)) {
      urlObj.searchParams.set(k, v);
    }

    try {
      const res = await fetch(urlObj.toString(), {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Bob-PR-Health'
        }
      });
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      list.push(...batch);
      if (batch.length < 100) break;
      page++;
    } catch (err) {
      console.error(`Error fetching page ${page} from ${url}:`, err);
      break;
    }
  }
  return list;
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
      return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
    }

    const reposMap: Record<string, any> = {};
    const botToken = process.env.GITHUB_TOKEN;

    // Run direct user repos, orgs list, and bot repos fetches in parallel
    const [directRepos, orgs, botRepos] = await Promise.all([
      fetchAllPages('https://api.github.com/user/repos', token, {
        affiliation: 'owner,collaborator,organization_member',
        visibility: 'all'
      }).catch(err => {
        console.error('Failed to fetch direct user repos:', err);
        return [];
      }),
      fetch('https://api.github.com/user/orgs?per_page=100', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Bob-PR-Health'
        }
      }).then(async res => {
        if (!res.ok) return [];
        return await res.json().catch(() => []);
      }).catch(err => {
        console.error('Failed to fetch orgs:', err);
        return [];
      }),
      botToken ? fetchAllPages('https://api.github.com/user/repos', botToken).catch(err => {
        console.error('Failed to fetch bot repos:', err);
        return [];
      }) : Promise.resolve([])
    ]);

    // Process direct repos
    for (const r of directRepos) {
      reposMap[r.full_name] = normalizeRepo(r, 'direct');
    }

    // Process bot repos
    const agentRepos: Record<string, string> = {};
    for (const r of botRepos) {
      const perm = r.permissions?.admin ? 'admin' : r.permissions?.push ? 'write' : 'read';
      agentRepos[r.full_name] = perm;
    }

    // Fetch all org repos in parallel
    if (Array.isArray(orgs) && orgs.length > 0) {
      try {
        const orgReposLists = await Promise.all(
          orgs.map(async (org: any) => {
            if (!org?.login) return [];
            try {
              return await fetchAllPages(`https://api.github.com/orgs/${org.login}/repos`, token, {
                type: 'all'
              });
            } catch (err) {
              console.error(`Failed to fetch repos for org ${org.login}:`, err);
              return [];
            }
          })
        );

        for (const orgRepos of orgReposLists) {
          for (const r of orgRepos) {
            if (!reposMap[r.full_name]) {
              reposMap[r.full_name] = normalizeRepo(r, 'org');
            }
          }
        }
      } catch (err) {
        console.error('Failed to discover org repos:', err);
      }
    }

    // Filters & Target Overrides
    let rawTargetRepos = process.env.TARGET_REPOS || '';
    const targetReposOverride = rawTargetRepos
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);

    let discovered = Object.values(reposMap);
    if (targetReposOverride.length > 0) {
      discovered = discovered.filter(r => targetReposOverride.includes(r.full_name));
    }

    const uname = user.username;
    const accessible = discovered.filter((r: any) => {
      return (
        r.permissions?.push ||
        r.permissions?.admin ||
        r.owner_login.toLowerCase() === uname.toLowerCase()
      );
    });

    // Sort by pushed_at descending
    accessible.sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());

    // Sync to database user_repos
    const existingRepos = await query('SELECT full_name FROM user_repos WHERE user_id = $1', [user.id]);
    const existingSet = new Set(existingRepos.map(ur => ur.full_name));

    for (const r of accessible) {
      const isPrivate = r.private ? 1 : 0;
      const isArchived = r.archived ? 1 : 0;
      const isFork = r.fork ? 1 : 0;
      const agentPerm = agentRepos[r.full_name] || 'none';
      const permLevel =
        r.owner_login.toLowerCase() === uname.toLowerCase()
          ? 'owner'
          : r.permissions?.admin
          ? 'admin'
          : 'push';
      const now = new Date().toISOString();

      if (!existingSet.has(r.full_name)) {
        await run(
          'INSERT INTO user_repos (user_id, full_name, private, url, language, permissions_level, agent_permission, archived, fork, last_synced) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [
            user.id,
            r.full_name,
            isPrivate,
            r.url,
            r.language,
            permLevel,
            agentPerm,
            isArchived,
            isFork,
            now
          ]
        );
      } else {
        await run(
          'UPDATE user_repos SET agent_permission = $1, last_synced = $2 WHERE user_id = $3 AND full_name = $4',
          [agentPerm, now, user.id, r.full_name]
        );
      }
    }

    console.log(`Discover Repos: ${uname} -> ${accessible.length} repos`);
    return NextResponse.json({
      repos: accessible,
      total: accessible.length,
      whitelisted: targetReposOverride.length > 0
    });
  } catch (error: any) {
    console.error('Discover repos endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

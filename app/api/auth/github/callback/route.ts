import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { get, run } from '@/lib/db';
import { encryptToken, signSession } from '@/lib/auth';

export async function GET(request: Request) {
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const baseUrl = host ? `${proto}://${host}` : request.url;

  const { searchParams } = new URL(request.url);
  const returnedState = searchParams.get('state');
  const code = searchParams.get('code');
  
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  
  if (!returnedState || returnedState !== storedState) {
    console.warn('OAuth state mismatch — possible CSRF');
    return NextResponse.redirect(new URL('/?error=invalid_state', baseUrl));
  }
  
  // Clean up state cookie
  const expiredCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/'
  };
  cookieStore.set('oauth_state', '', expiredCookie);
  cookieStore.set('oauth_portal', '', expiredCookie);
  
  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', baseUrl));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'GitHub credentials not configured' }, { status: 500 });
  }

  try {
    // 1. Trade code for access token
    let tokenData: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            state: returnedState
          })
        });
        
        if (tokenRes.ok) {
          tokenData = await tokenRes.json();
          break;
        }
      } catch (err) {
        if (attempt === 4) throw err;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      console.error('No access token in GitHub OAuth response:', {
        error: tokenData?.error,
        error_description: tokenData?.error_description
      });
      return NextResponse.redirect(new URL('/?error=no_token', request.url));
    }

    // 2. Fetch user profile
    let userData: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Bob-PR-Health'
          }
        });
        if (userRes.ok) {
          userData = await userRes.json();
          break;
        }
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const githubId = userData?.id;
    const username = userData?.login;

    if (!githubId || !username) {
      return NextResponse.redirect(new URL('/?error=invalid_user_profile', request.url));
    }

    // 3. Upsert user in database
    let user = await get('SELECT * FROM users WHERE github_id = $1', [githubId]);
    const encryptedToken = encryptToken(accessToken);
    const now = new Date().toISOString();

    if (!user) {
      const insertRes = await run(
        'INSERT INTO users (github_id, username, avatar, name, email, created_at, last_login, access_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [githubId, username, userData.avatar_url, userData.name || username, userData.email, now, now, encryptedToken]
      );
      user = {
        id: insertRes.lastInsertRowId,
        github_id: githubId,
        username,
        avatar: userData.avatar_url,
        name: userData.name || username,
        email: userData.email
      };
    } else {
      await run(
        'UPDATE users SET avatar = $1, name = $2, email = $3, last_login = $4, access_token = $5 WHERE id = $6',
        [userData.avatar_url, userData.name || username, userData.email, now, encryptedToken, user.id]
      );
      user.avatar = userData.avatar_url;
      user.name = userData.name || username;
      user.email = userData.email;
    }

    // Ensure user settings row exists
    let settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [user.id]);
    if (!settings) {
      await run('INSERT INTO user_settings (user_id, scan_interval, created_at, updated_at) VALUES ($1, 300, $2, $3)', [user.id, now, now]);
    }

    // 4. Sign session cookie
    const token = signSession(user);
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    console.log(`Auth Success: ${username}`);
    
    // Check if the user already has repositories synced in user_repos
    const reposCount = await get('SELECT COUNT(*) as count FROM user_repos WHERE user_id = $1', [user.id]);
    const hasRepos = Number(reposCount?.count || 0) > 0;
    
    if (hasRepos) {
      console.log(`User ${username} already has synced repos. Redirecting straight to dashboard.`);
      return NextResponse.redirect(new URL('/dashboard', baseUrl));
    }

    return NextResponse.redirect(new URL('/permissions', baseUrl));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=oauth_failed', baseUrl));
  }
}



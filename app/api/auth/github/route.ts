import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedPortal = searchParams.get('portal');
  let portal: 'user' | 'org';
  
  // Backwards compat checks
  if (requestedPortal === 'user' || requestedPortal === 'org') {
    portal = requestedPortal;
  } else {
    if (searchParams.get('scope') === 'user') {
      portal = 'user';
    } else if (searchParams.get('install')) {
      portal = 'org';
    } else {
      portal = 'user';
    }
  }

  const state = crypto.randomBytes(24).toString('hex');
  const scopes = 'repo read:org write:discussion workflow user:email';
  
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GITHUB_CLIENT_ID not configured' }, { status: 500 });
  }

  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}&allow_signup=true`;

  const response = NextResponse.redirect(githubUrl);
  
  const cookieStore = await cookies();
  const secureCookie = process.env.NODE_ENV === 'production';
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    maxAge: 600,
    path: '/'
  });
  cookieStore.set('oauth_portal', portal, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    maxAge: 600,
    path: '/'
  });

  return response;
}

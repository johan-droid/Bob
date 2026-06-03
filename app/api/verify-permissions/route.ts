import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { decryptToken } from '@/lib/auth';
import { get } from '@/lib/db';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await get('SELECT * FROM users WHERE id = $1', [sessionUser.db_id]);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const token = decryptToken(user.access_token);
    if (!token) {
      return NextResponse.json({ error: 'Session expired, please re-login' }, { status: 401 });
    }

    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Bob-PR-Health'
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Token validation failed' }, { status: 401 });
    }

    const scopesRaw = res.headers.get('X-OAuth-Scopes') || '';
    const granted = scopesRaw.split(',').map(s => s.trim()).filter(Boolean);
    const required = ['repo', 'read:org', 'write:discussion', 'workflow', 'user:email'];

    const satisfied = (needed: string) => {
      if (granted.includes(needed)) return true;
      const parent = needed.split(':')[0];
      return granted.some(g => g === parent || g.startsWith(`${parent}:`));
    };

    const missing = required.filter(s => !satisfied(s));

    return NextResponse.json({
      granted,
      required,
      missing,
      all_granted: missing.length === 0
    });
  } catch (error: any) {
    console.error('Verify permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

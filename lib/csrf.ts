import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const CSRF_COOKIE = 'bob_csrf_token';

export async function issueCsrfToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  });
  return token;
}

export async function requireCsrf(request: Request) {
  const headerToken = request.headers.get('X-CSRFToken') || request.headers.get('X-CSRF-Token');
  const cookieToken = (await cookies()).get(CSRF_COOKIE)?.value;

  if (!headerToken || !cookieToken) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const headerBytes = Buffer.from(headerToken);
  const cookieBytes = Buffer.from(cookieToken);
  if (headerBytes.length !== cookieBytes.length) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  if (!crypto.timingSafeEqual(headerBytes, cookieBytes)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  return null;
}

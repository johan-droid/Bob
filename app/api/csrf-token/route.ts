import { NextResponse } from 'next/server';
import { issueCsrfToken } from '@/lib/csrf';

export async function GET() {
  const csrfToken = await issueCsrfToken();
  const response = NextResponse.json({ csrf_token: csrfToken });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

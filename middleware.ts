import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const WINDOW_SIZE_IN_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 60;

// Simple in-memory store for rate limiting (Note: in a serverless environment like Vercel this is reset per-instance, but fine for basic protection)
const ipRequestCounts = new Map<string, { count: number, resetTime: number }>();

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/webhooks/github') {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();

    let rateLimitInfo = ipRequestCounts.get(ip);

    if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
      rateLimitInfo = { count: 1, resetTime: now + (WINDOW_SIZE_IN_SECONDS * 1000) };
    } else {
      rateLimitInfo.count++;
    }

    ipRequestCounts.set(ip, rateLimitInfo);

    if (rateLimitInfo.count > MAX_REQUESTS_PER_WINDOW) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/webhooks/github',
};

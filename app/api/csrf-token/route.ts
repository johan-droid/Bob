import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ csrf_token: 'bob-csrf-token-compat-value' });
}

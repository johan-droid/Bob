import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { runScanForUser } from '@/lib/scanner';
import { requireCsrf } from '@/lib/csrf';

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    // Run the scan asynchronously in the event loop (background execution)
    runScanForUser(sessionUser.db_id, (global as any).socketEmitter).catch(err => {
      console.error(`Background manual scan failed for user ${sessionUser.username}:`, err);
    });

    return NextResponse.json(
      { success: true, message: 'Scan initiated in background' },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('Scan trigger endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

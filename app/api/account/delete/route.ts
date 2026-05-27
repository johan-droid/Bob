import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { run } from '@/lib/db';
import { requireCsrf } from '@/lib/csrf';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const username = sessionUser.username;
    
    // Delete user from DB (foreign keys cascade delete repo, issues, settings)
    await run('DELETE FROM users WHERE id = $1', [sessionUser.db_id]);
    
    const response = NextResponse.json({ success: true });
    
    // Delete cookies
    const cookieStore = await cookies();
    cookieStore.delete('session');
    
    console.log(`User account deleted permanently: ${username}`);
    return response;
  } catch (error: any) {
    console.error('Failed to delete account:', error);
    return NextResponse.json({ error: 'Failed to delete account due to a server error', message: error.message }, { status: 500 });
  }
}

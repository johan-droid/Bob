import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { query } from '@/lib/db';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const repos = await query('SELECT * FROM user_repos WHERE user_id = $1', [sessionUser.db_id]);

    const list = repos.map(ur => ({
      full_name: ur.full_name,
      private: ur.private === 1 || ur.private === true,
      language: ur.language,
      permissions_level: ur.permissions_level,
      agent_permission: ur.agent_permission,
      archived: ur.archived === 1 || ur.archived === true,
      fork: ur.fork === 1 || ur.fork === true,
      last_synced: ur.last_synced
    }));

    return NextResponse.json({ repos: list, total: list.length });
  } catch (error: any) {
    console.error('Failed to get repos:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

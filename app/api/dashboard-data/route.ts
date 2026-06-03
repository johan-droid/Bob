import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { getUserDashboardData } from '@/lib/scanner';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getUserDashboardData(sessionUser.db_id);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to retrieve dashboard data:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

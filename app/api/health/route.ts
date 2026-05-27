import { NextResponse } from 'next/server';
import { get, query } from '@/lib/db';

export async function GET() {
  const health: Record<string, any> = {
    status: 'ok',
    service: 'Bob PR Health Scanner',
    timestamp: new Date().toISOString(),
    database: 'unknown',
    users: 0,
    tracked_repos: 0
  };

  try {
    // Ping DB
    await get('SELECT 1');
    health.database = 'connected';
    
    // Get counts
    const usersCount = await get('SELECT COUNT(*) as cnt FROM users');
    health.users = Number(usersCount?.cnt || 0);

    const reposCount = await get('SELECT COUNT(*) as cnt FROM user_repos');
    health.tracked_repos = Number(reposCount?.cnt || 0);
  } catch (error: any) {
    health.status = 'degraded';
    health.database = `error: ${error.message.substring(0, 100)}`;
  }

  return NextResponse.json(health);
}

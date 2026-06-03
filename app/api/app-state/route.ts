import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { get, run } from '@/lib/db';
import { getUserDashboardData } from '@/lib/scanner';

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

    let settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [user.id]);
    if (!settings) {
      const now = new Date().toISOString();
      await run('INSERT INTO user_settings (user_id, scan_interval, created_at, updated_at) VALUES ($1, 300, $2, $3)', [user.id, now, now]);
      settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [user.id]);
    }

    const dashboard = await getUserDashboardData(user.id);
    const excludedRepos = settings.excluded_repos
      ? settings.excluded_repos.split(',').map((r: string) => r.trim()).filter(Boolean)
      : [];

    const activeRepos = dashboard.repos.filter((r: any) => r.is_active);

    return NextResponse.json({
      user: {
        id: user.id,
        github_id: user.github_id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        last_login: user.last_login
      },
      dashboard,
      settings: {
        scan_interval: settings.scan_interval,
        excluded_repos: excludedRepos,
        notify_in_app: settings.notify_in_app === 1 || settings.notify_in_app === true,
        slack_webhook: settings.slack_webhook,
        discord_webhook: settings.discord_webhook,
        auto_label_conflict: settings.auto_label_conflict === 1 || settings.auto_label_conflict === true,
        tag_author_on_fail: settings.tag_author_on_fail === 1 || settings.tag_author_on_fail === true,
        updated_at: settings.updated_at
      },
      meta: {
        scan_interval_seconds: settings.scan_interval,
        tracked_repo_count: dashboard.repos.length,
        active_repo_count: activeRepos.length,
        target_repos_configured: !!process.env.TARGET_REPOS,
        websocket_path: '/socket.io'
      }
    });
  } catch (error: any) {
    console.error('Failed to retrieve app state:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

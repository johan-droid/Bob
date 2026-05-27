import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { requireCsrf } from '@/lib/csrf';
import { get, run } from '@/lib/db';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [sessionUser.db_id]);
    if (!settings) {
      const now = new Date().toISOString();
      await run('INSERT INTO user_settings (user_id, scan_interval, created_at, updated_at) VALUES ($1, 300, $2, $3)', [sessionUser.db_id, now, now]);
      settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [sessionUser.db_id]);
    }

    const excludedRepos = settings.excluded_repos
      ? settings.excluded_repos.split(',').map((r: string) => r.trim()).filter(Boolean)
      : [];

    return NextResponse.json({
      scan_interval: settings.scan_interval,
      excluded_repos: excludedRepos,
      notify_in_app: settings.notify_in_app === 1 || settings.notify_in_app === true,
      slack_webhook: settings.slack_webhook,
      discord_webhook: settings.discord_webhook,
      auto_label_conflict: settings.auto_label_conflict === 1 || settings.auto_label_conflict === true,
      tag_author_on_fail: settings.tag_author_on_fail === 1 || settings.tag_author_on_fail === true
    });
  } catch (error: any) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const data = await request.json();
    let settings = await get('SELECT * FROM user_settings WHERE user_id = $1', [sessionUser.db_id]);
    const now = new Date().toISOString();

    if (!settings) {
      await run(
        'INSERT INTO user_settings (user_id, scan_interval, excluded_repos, notify_in_app, slack_webhook, discord_webhook, auto_label_conflict, tag_author_on_fail, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          sessionUser.db_id,
          data.scan_interval !== undefined ? Number(data.scan_interval) : 300,
          data.excluded_repos !== undefined ? data.excluded_repos.join(',') : '',
          data.notify_in_app !== undefined ? (data.notify_in_app ? 1 : 0) : 1,
          data.slack_webhook || '',
          data.discord_webhook || '',
          data.auto_label_conflict !== undefined ? (data.auto_label_conflict ? 1 : 0) : 1,
          data.tag_author_on_fail !== undefined ? (data.tag_author_on_fail ? 1 : 0) : 0,
          now,
          now
        ]
      );
    } else {
      const scanInterval = data.scan_interval !== undefined ? Number(data.scan_interval) : settings.scan_interval;
      const excludedRepos = data.excluded_repos !== undefined ? data.excluded_repos.join(',') : settings.excluded_repos;
      const notifyInApp = data.notify_in_app !== undefined ? (data.notify_in_app ? 1 : 0) : settings.notify_in_app;
      const slackWebhook = data.slack_webhook !== undefined ? data.slack_webhook : settings.slack_webhook;
      const discordWebhook = data.discord_webhook !== undefined ? data.discord_webhook : settings.discord_webhook;
      const autoLabelConflict = data.auto_label_conflict !== undefined ? (data.auto_label_conflict ? 1 : 0) : settings.auto_label_conflict;
      const tagAuthorOnFail = data.tag_author_on_fail !== undefined ? (data.tag_author_on_fail ? 1 : 0) : settings.tag_author_on_fail;

      await run(
        'UPDATE user_settings SET scan_interval = $1, excluded_repos = $2, notify_in_app = $3, slack_webhook = $4, discord_webhook = $5, auto_label_conflict = $6, tag_author_on_fail = $7, updated_at = $8 WHERE user_id = $9',
        [
          scanInterval,
          excludedRepos,
          notifyInApp,
          slackWebhook,
          discordWebhook,
          autoLabelConflict,
          tagAuthorOnFail,
          now,
          sessionUser.db_id
        ]
      );
    }

    return NextResponse.json({ saved: true });
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

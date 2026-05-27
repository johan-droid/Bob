import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { requireCsrf } from '@/lib/csrf';
import { get, run } from '@/lib/db';
import { decryptToken } from '@/lib/auth';
import { PRHealthScanner, getUserDashboardData } from '@/lib/scanner';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const issueId = parseInt(id, 10);

  try {
    const issue = await get('SELECT * FROM pr_issues WHERE id = $1 AND user_id = $2', [issueId, sessionUser.db_id]);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    if (!issue.run_id) {
      return NextResponse.json({ error: 'No CI run ID associated with this issue' }, { status: 400 });
    }

    const user = await get('SELECT * FROM users WHERE id = $1', [sessionUser.db_id]);
    const token = decryptToken(user.access_token);
    if (!token) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const scanner = new PRHealthScanner(token, [], process.env.ASSIGNEE_USERNAME || 'jules');
    const result = await scanner.rerunWorkflow(issue.repo, parseInt(issue.run_id, 10));

    if (result && !result.error) {
      const now = new Date().toISOString();
      await run(
        'UPDATE pr_issues SET status = $1, updated_at = $2 WHERE id = $3',
        ['in_progress', now, issueId]
      );

      // Emit Socket.IO updates
      if ((global as any).socketEmitter) {
        const dashboardData = await getUserDashboardData(sessionUser.db_id);
        (global as any).socketEmitter(sessionUser.username, 'update', dashboardData);
      }

      return NextResponse.json({ success: true, message: 'CI re-run triggered' });
    }

    return NextResponse.json({ error: result?.error || 'Failed to re-run CI' }, { status: 500 });
  } catch (error: any) {
    console.error('Rerun CI route error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

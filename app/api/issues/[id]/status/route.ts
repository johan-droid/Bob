import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { requireCsrf } from '@/lib/csrf';
import { get, run } from '@/lib/db';
import { getUserDashboardData } from '@/lib/scanner';

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
    const data = await request.json();
    const status = data.status;

    if (!['pending', 'in_progress', 'failed', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const issue = await get('SELECT * FROM pr_issues WHERE id = $1 AND user_id = $2', [issueId, sessionUser.db_id]);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    await run(
      'UPDATE pr_issues SET status = $1, updated_at = $2 WHERE id = $3',
      [status, now, issueId]
    );

    const updatedIssue = await get('SELECT * FROM pr_issues WHERE id = $1', [issueId]);

    // Emit Socket.IO updates
    if ((global as any).socketEmitter) {
      const dashboardData = await getUserDashboardData(sessionUser.db_id);
      (global as any).socketEmitter(sessionUser.username, 'update', dashboardData);
    }

    return NextResponse.json({
      saved: true,
      issue: {
        id: updatedIssue.id,
        repo: updatedIssue.repo,
        issue_key: updatedIssue.issue_key,
        title: updatedIssue.title,
        url: updatedIssue.url,
        branch: updatedIssue.branch,
        pr_number: updatedIssue.pr_number,
        run_id: updatedIssue.run_id,
        type: updatedIssue.issue_type,
        status: updatedIssue.status,
        author: updatedIssue.author,
        last_commented_at: updatedIssue.last_commented_at,
        comment_count: updatedIssue.comment_count,
        created_at: updatedIssue.created_at,
        updated_at: updatedIssue.updated_at
      }
    });
  } catch (error: any) {
    console.error('Update issue status error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

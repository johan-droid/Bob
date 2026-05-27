import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { get } from '@/lib/db';
import { decryptToken } from '@/lib/auth';
import { PRHealthScanner } from '@/lib/scanner';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const issueId = parseInt(id, 10);

  try {
    const data = await request.json();
    const reviewers = data.reviewers;

    if (!reviewers || !Array.isArray(reviewers) || reviewers.length === 0) {
      return NextResponse.json({ error: 'No reviewers specified' }, { status: 400 });
    }

    const issue = await get('SELECT * FROM pr_issues WHERE id = $1 AND user_id = $2', [issueId, sessionUser.db_id]);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    if (!issue.pr_number) {
      return NextResponse.json({ error: 'No PR number associated with this issue' }, { status: 400 });
    }

    const user = await get('SELECT * FROM users WHERE id = $1', [sessionUser.db_id]);
    const token = decryptToken(user.access_token);
    if (!token) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const scanner = new PRHealthScanner(token, [], process.env.ASSIGNEE_USERNAME || 'jules');
    const result = await scanner.requestReview(issue.repo, issue.pr_number, reviewers);

    if (result && !result.error) {
      return NextResponse.json({ success: true, message: `Review requested from ${reviewers.join(', ')}` });
    }

    return NextResponse.json({ error: result?.error || 'Failed to request review' }, { status: 500 });
  } catch (error: any) {
    console.error('Request review route error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

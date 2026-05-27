import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-helper';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repoFilter = searchParams.get('repo');

  try {
    let sql = 'SELECT * FROM pr_issues WHERE user_id = $1 ORDER BY updated_at DESC';
    let params: any[] = [sessionUser.db_id];

    if (repoFilter) {
      sql = 'SELECT * FROM pr_issues WHERE user_id = $1 AND repo = $2 ORDER BY updated_at DESC';
      params.push(repoFilter);
    }

    const issues = await query(sql, params);

    const list = issues.map(i => ({
      id: i.id,
      repo: i.repo,
      issue_key: i.issue_key,
      title: i.title,
      url: i.url,
      branch: i.branch,
      pr_number: i.pr_number,
      run_id: i.run_id,
      type: i.issue_type,
      status: i.status,
      author: i.author,
      last_commented_at: i.last_commented_at,
      comment_count: i.comment_count,
      created_at: i.created_at,
      updated_at: i.updated_at
    }));

    return NextResponse.json({ issues: list });
  } catch (error: any) {
    console.error('Failed to get issues:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

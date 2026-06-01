import { NextResponse } from 'next/server';
import { POST as validatePost, executeMergeHandler } from '@/lib/merge-gates';
import { getMergeContract } from '@/lib/merge-gates';
import { getSessionUser } from '@/lib/auth-helper';

// POST /api/merge-gates/validate - Validate merge prerequisites
// POST /api/merge-gates/execute - Execute squash-and-merge
export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'execute') {
    return executeMergeHandler(request);
  }

  // Default action is validate
  return validatePost(request);
}

// GET /api/merge-gates?repo=owner/repo&prNumber=123
export async function GET(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get('repo');
    const prNumber = searchParams.get('prNumber');

    if (!repo || !prNumber) {
      return NextResponse.json(
        { error: 'Missing repo or prNumber parameter' },
        { status: 400 }
      );
    }

    const result = await getMergeContract(repo, parseInt(prNumber, 10));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Merge contract fetch error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

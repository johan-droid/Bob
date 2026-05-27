import { cookies } from 'next/headers';
import { verifySession } from './auth';

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) return null;
  return verifySession(sessionToken);
}

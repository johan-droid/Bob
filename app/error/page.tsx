import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

const messages: Record<string, { title: string; body: string }> = {
  invalid_state: {
    title: 'OAuth state mismatch',
    body: 'The authorization round-trip was interrupted or replayed. Start the GitHub sign-in again.'
  },
  no_code: {
    title: 'Missing authorization code',
    body: 'GitHub did not return an authorization code. Try signing in again.'
  },
  no_token: {
    title: 'Token exchange failed',
    body: 'The backend could not exchange the GitHub code for a token. Check your OAuth app settings.'
  },
  oauth_failed: {
    title: 'OAuth failed',
    body: 'An unexpected error happened while completing GitHub sign-in.'
  }
};

export default async function ErrorPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const error = params.error || 'oauth_failed';
  const message = messages[error] || messages.oauth_failed;

  return (
    <>
      <SiteHeader minimal />
      <main className="error-page auth-layout">
        <section className="error-card">
          <div className="brand">
            <span className="brand__badge">!</span>
            <span>Authentication Error</span>
          </div>
          <h1 className="auth-title">{message.title}</h1>
          <p>{message.body}</p>
          <div className="auth__actions" style={{ justifyContent: 'center' }}>
            <Link href="/org/login" className="button">Try again</Link>
            <Link href="/docs" className="button-secondary">Read setup docs</Link>
          </div>
        </section>
      </main>
    </>
  );
}
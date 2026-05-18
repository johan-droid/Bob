import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function UserLoginPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="auth-page auth-layout">
        <section className="auth-card">
          <div className="brand">
            <span className="brand__badge">⌘</span>
            <span>Developer Access</span>
          </div>
          <h1 className="auth-title">Sign in with GitHub</h1>
          <p>Track your pull requests, view assigned work, and keep your personal workspace in sync.</p>
          <div className="auth__actions" style={{ justifyContent: 'center' }}>
            <Link href="/auth/github?portal=user" className="button">Continue with GitHub</Link>
            <Link href="/" className="button-secondary">Back to home</Link>
          </div>
          <p className="auth-note">The backend OAuth callback is still supported for compatibility.</p>
        </section>
      </main>
    </>
  );
}
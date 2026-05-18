import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function OrgLoginPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="auth-page auth-layout">
        <section className="auth-card">
          <div className="brand">
            <span className="brand__badge">☰</span>
            <span>Organization Access</span>
          </div>
          <h1 className="auth-title">Connect your GitHub org</h1>
          <p>Authorize Bob once, discover every accessible repository, and launch automated PR health monitoring.</p>
          <div className="auth__actions" style={{ justifyContent: 'center' }}>
            <a href="/auth/github?portal=org" className="button">Connect GitHub Workspace</a>
            <Link href="/org/signup" className="button-secondary">Read the setup path</Link>
          </div>
          <p className="auth-note">Organization onboarding now starts from a single simplified GitHub auth URL.</p>
        </section>
      </main>
    </>
  );
}

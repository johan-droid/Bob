import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

const routes = [
  ['/auth/github', 'Simplified GitHub auth entrypoint'],
  ['/auth/github/callback', 'OAuth callback alias'],
  ['/api/dashboard-data', 'Dashboard payload'],
  ['/api/verify-permissions', 'Scope verification'],
  ['/api/discover-repos', 'Repository discovery'],
  ['/api/scan', 'Manual PR health scan']
];

export default function DocsPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="docs-page">
        <section className="doc-card">
          <div className="kicker">Documentation</div>
          <h1 className="auth-title">How the Next.js front end talks to Bob</h1>
          <p>
            The new UI keeps the old backend API intact, but the front end is now a React/Next.js app with cleaner routes and redirects.
          </p>

          <div className="doc-grid" style={{ marginTop: 24 }}>
            {routes.map(([route, description]) => (
              <div className="step-card" key={route}>
                <div className="mono">{route}</div>
                <p style={{ marginTop: 10 }}>{description}</p>
              </div>
            ))}
          </div>

          <div className="doc__actions">
            <Link href="/org/login" className="button">Open onboarding</Link>
            <Link href="/privacy" className="button-secondary">Privacy</Link>
          </div>
        </section>
      </main>
    </>
  );
}
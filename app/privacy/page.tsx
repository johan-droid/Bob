import { SiteHeader } from '@/components/site-header';

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="privacy-page">
        <section className="doc-card">
          <div className="kicker">Privacy</div>
          <h1 className="auth-title">Token handling and access</h1>
          <p>
            Bob keeps OAuth access tokens server-side, uses scoped GitHub permissions, and surfaces only the data needed to monitor PR health.
          </p>
          <div className="stack" style={{ marginTop: 22 }}>
            <div className="feature-card"><h3>Server-side tokens</h3><p>User tokens are stored by the backend and not exposed in the browser.</p></div>
            <div className="feature-card"><h3>Scoped access</h3><p>The auth flow requests only the GitHub scopes needed for monitoring and notifications.</p></div>
            <div className="feature-card"><h3>Local rewrites</h3><p>The Next.js frontend proxies backend API calls without leaking secrets into the UI layer.</p></div>
          </div>
        </section>
      </main>
    </>
  );
}
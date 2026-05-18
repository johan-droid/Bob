import Link from 'next/link';

const modules = [
  ['01', 'Authorize', 'Start a real GitHub OAuth session through the Flask backend.'],
  ['02', 'Discover', 'After sign-in, Bob loads repositories from the authenticated GitHub account.'],
  ['03', 'Monitor', 'Dashboards populate from live API and WebSocket data only.'],
  ['04', 'Act', 'Use the authenticated workspace to triage conflicts and failing checks.']
];

export default function LandingPage() {
  return (
    <main className="google-landing">
      <header className="google-nav">
        <Link href="/" className="google-brand" aria-label="Bob home">
          <span>B</span>
          Bob
        </Link>
        <nav aria-label="Primary">
          <Link href="/docs">Docs</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/user/login">Sign in</Link>
          <a href="/auth/github?portal=org" className="google-primary">Connect GitHub</a>
        </nav>
      </header>

      <section className="google-hero">
        <div className="google-ribbons" aria-hidden="true">
          <span className="google-ribbon blue" />
          <span className="google-ribbon red" />
          <span className="google-ribbon yellow" />
          <span className="google-ribbon green" />
        </div>

        <div className="google-copy">
          <div className="google-chip">
            <i className="blue" />
            <i className="red" />
            <i className="yellow" />
            <i className="green" />
            Real GitHub data after sign-in
          </div>
          <h1>Bob PR Health Monitor</h1>
          <p>
            Connect GitHub, verify scopes, and let Bob build your dashboard from authenticated repository data. The public page stays focused on sign-in; workspace data appears only after OAuth succeeds.
          </p>
          <div className="google-actions">
            <a href="/auth/github?portal=org" className="google-primary">Start GitHub sign-in</a>
            <a href="/auth/github?portal=user" className="google-secondary">Developer sign in</a>
          </div>
        </div>

        <div className="google-auth-card">
          <div className="google-panel-head">
            <div>
              <span>Authentication path</span>
              <h2>GitHub first, dashboard second.</h2>
            </div>
            <strong>Ready</strong>
          </div>
          <div className="google-search">/auth/github?portal=org</div>
          <div className="google-auth-steps">
            <article>
              <span className="google-module-index tone-0">01</span>
              <div>
                <h3>Redirect to GitHub</h3>
                <p>Bob sends GitHub the exact callback URL used during token exchange.</p>
              </div>
            </article>
            <article>
              <span className="google-module-index tone-1">02</span>
              <div>
                <h3>Store the access token</h3>
                <p>The backend stores OAuth tokens server-side and keeps browser sessions scoped.</p>
              </div>
            </article>
            <article>
              <span className="google-module-index tone-3">03</span>
              <div>
                <h3>Load live workspace</h3>
                <p>Repository, issue, and status cards render from `/api/dashboard-data` after login.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="google-modules">
        <div>
          <span className="google-eyebrow">Authenticated dashboard</span>
          <h2>The public page only explains the flow. Data appears after GitHub auth.</h2>
        </div>
        <div className="google-module-grid">
          {modules.map(([step, title, text], index) => (
            <article key={title}>
              <span className={`google-module-index tone-${index}`}>{step}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

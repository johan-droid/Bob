import Link from 'next/link';

const signals = [
  ['blue', 'platform/auth', 'PR #482 has a base branch conflict', 'Needs owner'],
  ['red', 'web/dashboard', 'Workflow failed after dependency install', 'Failing CI'],
  ['green', 'api/scanner', 'All checks green and ready to merge', 'Ready']
];

const modules = [
  ['01', 'Discover', 'Map accessible repositories after GitHub authorization.'],
  ['02', 'Prioritize', 'Group conflicts and failed workflows into a clean action queue.'],
  ['03', 'Route', 'Nudge the right owners without flooding the team.'],
  ['04', 'Track', 'Give leads a live view of delivery health.']
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
          <Link href="/auth/github?portal=org" className="google-primary">Connect GitHub</Link>
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
            Real-time GitHub operations
          </div>
          <h1>Bob PR Health Monitor</h1>
          <p>
            A clean command center for merge conflicts, failing CI, and repository risk. Bob turns GitHub activity into a focused queue your team can act on immediately.
          </p>
          <div className="google-actions">
            <Link href="/auth/github?portal=org" className="google-primary">Start monitoring</Link>
            <Link href="/user/login" className="google-secondary">Developer sign in</Link>
          </div>
        </div>

        <div className="google-demo">
          <div className="google-demo-head">
            <div>
              <span>Bob workspace</span>
              <h2>Pipeline health</h2>
            </div>
            <strong>Live</strong>
          </div>
          <div className="google-search">show merge conflicts across active repos</div>
          <div className="google-tabs">
            <span>Conflicts</span>
            <span>CI failures</span>
            <span>Ready queue</span>
          </div>
          <div className="google-metrics">
            <article><span>Open signals</span><strong>8</strong></article>
            <article><span>Median age</span><strong>31m</strong></article>
            <article><span>Owners found</span><strong>6</strong></article>
          </div>
          <div className="google-signal-list">
            {signals.map(([tone, repo, detail, label]) => (
              <article key={repo}>
                <i className={tone} />
                <div>
                  <strong>{repo}</strong>
                  <p>{detail}</p>
                </div>
                <span>{label}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="google-modules">
        <div>
          <span className="google-eyebrow">Focused by design</span>
          <h2>Every signal lands where work actually happens.</h2>
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

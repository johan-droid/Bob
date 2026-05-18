import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const features = [
  {
    title: 'Proactive detection',
    text: 'Scan repositories continuously to catch merge conflicts and CI failures before they block the team.'
  },
  {
    title: 'Intelligent tagging',
    text: 'Route work to the right people automatically with scoped GitHub access and live alerts.'
  },
  {
    title: 'Executive control',
    text: 'Give engineering leads a clean dashboard for delivery health across the entire organization.'
  }
];

const steps = [
  'Sign in with GitHub',
  'Verify required scopes',
  'Discover repositories',
  'Launch the first scan'
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero page">
          <div className="hero__grid">
            <div>
              <div className="eyebrow">Next-gen pipeline intelligence</div>
              <h1>Engineering health, at galaxy scale.</h1>
              <p>
                Bob gives your team real-time visibility into pull request health, GitHub Action failures,
                and repo-level risk signals. The new Next.js front end keeps the experience fast and clean.
              </p>

              <div className="hero__actions">
                <Link href="/org/login" className="button">Start with GitHub</Link>
                <Link href="/docs" className="button-secondary">Read docs</Link>
              </div>

              <div className="stack" style={{ marginTop: 26 }}>
                <div className="kicker">Launch path</div>
                <div className="step-grid">
                  {steps.map((step, index) => (
                    <div className="step-card" key={step}>
                      <div className="badge">0{index + 1}</div>
                      <h3>{step}</h3>
                      <p>One clean path from login to active monitoring.</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero__visual">
              <div className="visual-grid">
                <div className="visual-card">
                  <div className="toggle-row">
                    <div>
                      <div className="kicker">Live dashboard</div>
                      <h3>Bob command center</h3>
                    </div>
                    <span className="status-pill success">Online</span>
                  </div>
                  <div className="kpi-grid" style={{ marginTop: 16 }}>
                    <div className="stat-card"><h3>42</h3><p>Tracked repos</p></div>
                    <div className="stat-card"><h3>8</h3><p>Pending items</p></div>
                    <div className="stat-card"><h3>96%</h3><p>Signal coverage</p></div>
                  </div>
                </div>

                <div className="visual-card">
                  <div className="toggle-row">
                    <div>
                      <div className="kicker">Auth flow</div>
                      <h3>Simplified sign-in</h3>
                    </div>
                    <span className="status-pill">/auth/github</span>
                  </div>
                  <p style={{ marginTop: 14 }}>
                    The frontend now uses a single GitHub auth entrypoint and the backend callback is preserved for compatibility.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section page">
          <div className="section__head">
            <div>
              <div className="kicker">Core modules</div>
              <h2>Autonomous monitoring</h2>
            </div>
            <Link href="/permissions" className="button-ghost">See onboarding</Link>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">✦</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section page">
          <div className="panel-grid">
            <div className="panel">
              <div className="kicker">Routes</div>
              <h3>Migration-safe URLs</h3>
              <p>
                Legacy HTML pages now redirect to clean React routes while backend API and OAuth paths are proxied through Next.js.
              </p>
              <div className="auth__actions">
                <Link href="/user/login" className="button-secondary">Developer login</Link>
                <Link href="/org/login" className="button">Organization login</Link>
              </div>
            </div>

            <div className="panel">
              <div className="kicker">Docs</div>
              <h3>What changed</h3>
              <p>
                The front end now runs as a Next.js app. Authentication links are simplified, and the dashboards use live backend data.
              </p>
              <div className="auth__actions">
                <Link href="/docs" className="button-secondary">Open docs</Link>
                <Link href="/privacy" className="button-ghost">Privacy</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
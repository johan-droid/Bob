import Link from 'next/link';
import './landing.css';
import { LandingClientLogic } from './landing-client-logic';
import { UpdateNote } from '@/components/update-note';


export default function LandingPage() {
  return (
    <div className="landing-page-root">
      {/* Mobile Drawer Overlay */}
      <div className="drawer-overlay" id="drawer-overlay"></div>
      <aside className="mobile-drawer" id="mobile-drawer" aria-label="Mobile navigation">
        <button className="icon-button drawer-close" id="close-drawer" type="button" aria-label="Close menu">
          <span className="material-symbols-outlined">close</span>
        </button>
        <Link href="/" className="drawer-brand">
          <span className="brand-mark">B</span>
          <span>Bob</span>
        </Link>
        <a href="#how-it-works">How it works</a>
        <a href="#features">Features</a>
        <Link href="/docs">Docs</Link>
        <Link href="/user/login">Sign in</Link>
        <a href="/auth/github?portal=org" className="drawer-cta">Connect GitHub</a>
      </aside>

      {/* Navigation */}
      <header className="site-header" id="navbar">
        <nav className="nav-shell" aria-label="Primary navigation">
          <Link href="/" className="brand" aria-label="Bob home">
            <span className="brand-mark">B</span>
            <span>Bob</span>
          </Link>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <Link href="/docs">Docs</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <div className="nav-actions">
            <Link href="/user/login" className="text-link">Sign in</Link>
            <a href="/auth/github?portal=org" className="button button-primary" id="nav-cta">
              <span className="material-symbols-outlined">hub</span>
              Connect GitHub
            </a>
          </div>
          <button className="icon-button mobile-menu-toggle" id="mobile-menu-toggle" type="button" aria-label="Open menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </nav>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="hero" id="top">
          <div className="hero-bg" aria-hidden="true">
            <div className="hero-blob blob-1"></div>
            <div className="hero-blob blob-2"></div>
            <div className="hero-blob blob-3"></div>
            <div className="hero-grid"></div>
            <div className="hero-noise"></div>
          </div>

          <div className="orbs" aria-hidden="true">
            <span className="orb orb-blue"></span>
            <span className="orb orb-red"></span>
            <span className="orb orb-yellow"></span>
            <span className="orb orb-green"></span>
          </div>

          <div className="hero-inner">
            <div className="hero-copy">
              <div className="hero-badge">
                <span className="badge-pulse"></span>
                <span className="badge-dots">
                  <span className="chip-dot blue"></span>
                  <span className="chip-dot red"></span>
                  <span className="chip-dot yellow"></span>
                  <span className="chip-dot green"></span>
                </span>
                Real GitHub data · Zero polling delays
              </div>

              <h1 className="hero-headline">
                Your PR health,<br />
                <span className="headline-accent" id="typed-words">always alive.</span>
              </h1>

              <p className="hero-sub">
                Bob connects to GitHub via OAuth to monitor repository health in real time. Effortlessly track PR states, merge conflicts, failing CI suites, and review bottlenecks—all on a speed-optimized, mobile-ready unified dashboard.
              </p>

              <div className="hero-actions">
                <a href="/auth/github?portal=org" className="button button-primary" id="hero-cta">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  Start with GitHub
                </a>
                <a href="/auth/github?portal=user" className="button button-ghost" id="hero-secondary">
                  <span className="material-symbols-outlined">code</span>
                  Developer sign-in
                </a>
              </div>

              <div className="trust-strip">
                <div className="trust-item">
                  <strong>OAuth</strong>
                  <span>Secure GitHub auth</span>
                </div>
                <div className="trust-item">
                  <strong>Live</strong>
                  <span>Real-time PR data</span>
                </div>
                <div className="trust-item">
                  <strong>Zero</strong>
                  <span>Third-party storage</span>
                </div>
              </div>
            </div>

            <div className="auth-card auth-panel" id="flow">
              <div className="card-glow"></div>

              <div className="auth-toolbar">
                <div>
                  <span className="eyebrow">Authentication path</span>
                  <h2>GitHub first,<br />dashboard second.</h2>
                </div>
                <span className="live-pill">
                  <span className="live-dot"></span>
                  Ready
                </span>
              </div>

              <div className="search-pill">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--blue)' }}>route</span>
                <code>/auth/github?portal=org</code>
              </div>

              <div className="auth-steps">
                <article className="auth-step">
                  <span className="step-badge blue-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                  </span>
                  <div>
                    <h3>Redirect to GitHub</h3>
                    <p>Bob sends GitHub the exact callback URL used during token exchange — no redirects leaked.</p>
                  </div>
                  <span className="step-num">01</span>
                </article>
                <article className="auth-step">
                  <span className="step-badge red-badge">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock</span>
                  </span>
                  <div>
                    <h3>Store access token</h3>
                    <p>Backend stores OAuth tokens server-side; browser sessions are scoped and never expose raw tokens.</p>
                  </div>
                  <span className="step-num">02</span>
                </article>
                <article className="auth-step">
                  <span className="step-badge green-badge">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>dashboard</span>
                  </span>
                  <div>
                    <h3>Load live workspace</h3>
                    <p>Repository, issue, and CI status cards render from authenticated API data — nothing cached publicly.</p>
                  </div>
                  <span className="step-num">03</span>
                </article>
              </div>

              <a href="/auth/github?portal=org" className="card-cta-btn">
                <span className="material-symbols-outlined">arrow_forward</span>
                Connect your GitHub
              </a>
            </div>
          </div>
        </section>

        {/* STATS BAR */}
        <div className="stats-bar" aria-label="Key metrics">
          <div className="stats-inner">
            <div className="stat-item">
              <div><strong className="stat-num" data-target="100">0</strong><span className="stat-unit">%</span></div>
              <span className="stat-label">Authenticated — no public data exposure</span>
            </div>
            <div className="stat-divider" aria-hidden="true"></div>
            <div className="stat-item">
              <div><strong className="stat-num" data-target="3">0</strong><span className="stat-unit">s</span></div>
              <span className="stat-label">Average dashboard load after OAuth</span>
            </div>
            <div className="stat-divider" aria-hidden="true"></div>
            <div className="stat-item">
              <div><strong className="stat-num" data-target="0">99</strong><span className="stat-unit"></span></div>
              <span className="stat-label">Third-party data brokers involved</span>
            </div>
            <div className="stat-divider" aria-hidden="true"></div>
            <div className="stat-item">
              <div><strong className="stat-num" data-target="1">0</strong><span className="stat-unit"> click</span></div>
              <span className="stat-label">To start your GitHub OAuth flow</span>
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section className="how-section" id="how-it-works">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">The flow</span>
              <h2 className="section-title">From zero to dashboard in seconds.</h2>
              <p className="section-sub">Bob&apos;s design is intentionally minimal: the public page exists only to initiate GitHub OAuth. All workspace data lives behind authentication.</p>
            </div>

            <div className="steps-track">
              <div className="steps-line" aria-hidden="true"></div>

              <div className="step-card">
                <div className="step-icon-wrap blue-wrap">
                  <span className="material-symbols-outlined">login</span>
                </div>
                <div className="step-content">
                  <span className="step-label">Step 01</span>
                  <h3>Authorize</h3>
                  <p>Click &quot;Connect GitHub&quot; — Bob opens the real GitHub OAuth page with minimal, explicit scopes.</p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-icon-wrap red-wrap">
                  <span className="material-symbols-outlined">verified_user</span>
                </div>
                <div className="step-content">
                  <span className="step-label">Step 02</span>
                  <h3>Verify</h3>
                  <p>GitHub redirects back with a code. Bob&apos;s Flask backend exchanges it for a scoped access token — stored server-side.</p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-icon-wrap yellow-wrap">
                  <span className="material-symbols-outlined">source</span>
                </div>
                <div className="step-content">
                  <span className="step-label">Step 03</span>
                  <h3>Discover</h3>
                  <p>Bob queries the GitHub API for your repositories, open pull requests, review status, and CI check runs.</p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-icon-wrap green-wrap">
                  <span className="material-symbols-outlined">monitoring</span>
                </div>
                <div className="step-content">
                  <span className="step-label">Step 04</span>
                  <h3>Monitor</h3>
                  <p>Your dashboard populates with live data. Triage conflicts, track failing checks, and act — all from one authenticated view.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features-section" id="features">
          <div className="section-container">
            <div className="section-header">
              <span className="section-eyebrow">What Bob tracks</span>
              <h2 className="section-title">Every signal that matters for PR health.</h2>
              <p className="section-sub">After GitHub auth, these modules populate from live API data — no stale caches, no polling nightmares.</p>
            </div>

            <div className="features-grid">
              <article className="feature-card feature-card-large">
                <div className="feature-icon blue-wrap">
                  <span className="material-symbols-outlined">merge</span>
                </div>
                <h3>Merge Conflict Radar</h3>
                <p>Instantly see which pull requests are blocked by merge conflicts. Bob highlights the affected files and branches so you can triage without opening GitHub.</p>
                <div className="feature-tag blue-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bolt</span>
                  Live from GitHub API
                </div>
              </article>

              <article className="feature-card">
                <div className="feature-icon red-wrap">
                  <span className="material-symbols-outlined">cancel</span>
                </div>
                <h3>CI Check Failures</h3>
                <p>Surface failing GitHub Actions and CI runs per PR. Drill down to which checks are red and why — without leaving your dashboard.</p>
                <div className="feature-tag red-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>integration_instructions</span>
                  GitHub Actions aware
                </div>
              </article>

              <article className="feature-card">
                <div className="feature-icon yellow-wrap">
                  <span className="material-symbols-outlined">rate_review</span>
                </div>
                <h3>Review Status</h3>
                <p>Track pending, approved, and requested-changes reviews at a glance. Know exactly who needs to act and who already has.</p>
                <div className="feature-tag yellow-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>group</span>
                  Per-reviewer detail
                </div>
              </article>

              <article className="feature-card">
                <div className="feature-icon green-wrap">
                  <span className="material-symbols-outlined">security</span>
                </div>
                <h3>Scope Transparency</h3>
                <p>Bob only requests the minimal GitHub OAuth scopes needed. Every permission is listed clearly before you authorize — no surprises.</p>
                <div className="feature-tag green-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified</span>
                  Minimal scope design
                </div>
              </article>

              <article className="feature-card feature-card-wide">
                <div className="feature-icon blue-wrap">
                  <span className="material-symbols-outlined">hub</span>
                </div>
                <h3>Multi-repo Workspace</h3>
                <p>All your repositories in one authenticated workspace. Switch between repos, compare PR health, and focus on what needs your attention most — powered entirely by the GitHub API with your token.</p>
                <div className="feature-tag blue-tag">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>account_tree</span>
                  Org + personal repos
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* CTA BAND */}
        <section className="cta-section">
          <div className="cta-inner">
            <div className="cta-blob cta-blob-1" aria-hidden="true"></div>
            <div className="cta-blob cta-blob-2" aria-hidden="true"></div>

            <div className="cta-text">
              <span className="section-eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Ready?</span>
              <h2 className="cta-headline">One click away from your<br />live PR dashboard.</h2>
              <p className="cta-sub">No setup, no config files. Just GitHub OAuth and an authenticated workspace built from real data.</p>
            </div>

            <div className="cta-actions">
              <a href="/auth/github?portal=org" className="button button-white" id="cta-main">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Connect GitHub — it&apos;s free
              </a>
              <Link href="/docs" className="button button-glass" id="cta-docs">
                <span className="material-symbols-outlined">menu_book</span>
                Read the docs
              </Link>
            </div>

            <p className="cta-footnote">GitHub OAuth only. No passwords stored. Revoke access anytime from GitHub settings.</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <Link href="/" className="brand" aria-label="Bob home">
            <span className="brand-mark">B</span>
            <span>Bob</span>
          </Link>
          <p className="footer-tagline">PR health monitoring powered by real GitHub data.</p>
          <div className="footer-links">
            <Link href="/docs">Docs</Link>
            <Link href="/privacy">Privacy</Link>
            <a href="https://github.com/johan-droid/bob" target="_blank" rel="noreferrer">Source</a>
            <a href="/auth/github?portal=org" className="footer-cta">Connect GitHub →</a>
          </div>
        </div>
      </footer>
      <LandingClientLogic />
      <UpdateNote />
    </div>
  );
}

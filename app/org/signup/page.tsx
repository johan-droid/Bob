import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

const steps = [
  'Authorize GitHub access',
  'Grant the required scopes',
  'Discover organization repos',
  'Complete the initial scan'
];

export default function OrgSignupPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="signup-page page">
        <section className="doc-card" style={{ width: 'min(900px, 100%)' }}>
          <div className="kicker">Organization onboarding</div>
          <h1 className="auth-title">A shorter setup path for GitHub</h1>
          <p>
            This flow replaces the older multi-page sign-in path with a simpler GitHub authorization step and a unified setup screen.
          </p>

          <div className="step-grid" style={{ marginTop: 24 }}>
            {steps.map((step, index) => (
              <div className="step-card" key={step}>
                <div className="badge">0{index + 1}</div>
                <h3>{step}</h3>
                <p>Bob will guide you through the rest after GitHub returns control to the app.</p>
              </div>
            ))}
          </div>

          <div className="doc__actions">
            <a href="/auth/github?portal=org" className="button">Start GitHub authorization</a>
            <Link href="/permissions" className="button-secondary">Open setup screen</Link>
          </div>
        </section>
      </main>
    </>
  );
}

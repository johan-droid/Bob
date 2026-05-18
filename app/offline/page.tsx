import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function OfflinePage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="offline-page auth-layout">
        <section className="offline-card">
          <div className="brand">
            <span className="brand__badge">⟡</span>
            <span>Offline</span>
          </div>
          <h1 className="auth-title">You are offline</h1>
          <p>The app can still show cached content, but live GitHub synchronization is currently unavailable.</p>
          <div className="auth__actions" style={{ justifyContent: 'center' }}>
            <Link href="/" className="button">Back to home</Link>
            <Link href="/org/dashboard" className="button-secondary">Open dashboard</Link>
          </div>
        </section>
      </main>
    </>
  );
}
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="site-footer__inner">
        <div className="stack">
          <Link href="/" className="brand">
            <span className="brand__badge">✦</span>
            <span>Bob</span>
          </Link>
          <span className="muted">Galaxy-scale PR intelligence for engineering teams.</span>
        </div>

        <div className="footer-links">
          <Link href="/docs">Docs</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/johan-droid/Bob" target="_blank" rel="noopener noreferrer">Source</a>
        </div>
      </div>
    </footer>
  );
}
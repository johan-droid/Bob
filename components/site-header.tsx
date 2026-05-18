import Link from 'next/link';

type SiteHeaderProps = {
  minimal?: boolean;
};

export function SiteHeader({ minimal = false }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand" aria-label="Bob home">
          <span className="brand__badge">✦</span>
          <span>Bob</span>
        </Link>

        {!minimal ? (
          <nav className="nav-links" aria-label="Primary">
            <Link href="/docs">Docs</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/org/dashboard">Dashboard</Link>
            <Link href="/user/login" className="button-secondary">Sign in</Link>
          </nav>
        ) : (
          <nav className="nav-links" aria-label="Primary">
            <Link href="/">Home</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
import type { Metadata } from 'next';
import './globals.css';
import './dashboard-refresh.css';
import './mobile-dashboard.css';


export const metadata: Metadata = {
  title: 'Bob | PR Health Monitor',
  description: 'Bob monitors pull request health with real-time GitHub signals, CI failure detection, merge conflict alerts, review tracking, and staleness analysis.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://bob-7ae2.onrender.com'),
  icons: {
    icon: '/icon.svg'
  },
  manifest: '/manifest.json'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
        {/*
          NOTE: Tailwind CSS is loaded via CDN for rapid prototyping.
          For production, install tailwindcss as a build dependency:
            npm install -D tailwindcss @tailwindcss/forms postcss autoprefixer
          Then configure postcss.config.js and tailwind.config.ts.
        */}
        <script
          src="https://cdn.tailwindcss.com?plugins=forms,container-queries"
          crossOrigin="anonymous"
          defer
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                darkMode: 'class',
                theme: {
                  extend: {
                    colors: {
                      brand: '#7c3aed',
                      'brand-glow': 'rgba(124, 58, 237, 0.15)',
                      surface: '#09090b',
                      'surface-card': '#18181b',
                      border: 'rgba(255, 255, 255, 0.08)',
                      success: '#10b981',
                      warning: '#f59e0b',
                      danger: '#ef4444'
                    }
                  }
                }
              }
            `
          }}
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            body {
              font-family: 'Inter', sans-serif;
              background: radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 30%),
                          radial-gradient(circle at top right, rgba(16, 185, 129, 0.04), transparent 25%),
                          #09090b !important;
            }
          `
        }} />
      </head>
      <body className="text-zinc-100 min-h-screen flex flex-col antialiased selection:bg-purple-500/30">{children}</body>
    </html>
  );
}

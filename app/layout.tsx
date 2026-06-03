import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bob | PR Health Monitor',
  description:
    'Bob monitors pull request health with real-time GitHub signals, CI failure detection, merge conflict alerts, review tracking, and staleness analysis.',
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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
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
      </head>
      <body>{children}</body>
    </html>
  );
}
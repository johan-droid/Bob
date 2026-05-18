import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bob | PR Health Monitor',
  description: 'Bob monitors pull request health with real-time GitHub signals, CI failure detection, and merge conflict alerts.',
  metadataBase: new URL('http://localhost:3000'),
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

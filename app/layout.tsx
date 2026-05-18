import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bob | Galaxy PR Intelligence',
  description: 'Bob is a high-fidelity PR health monitor with real-time analysis and proactive conflict detection.',
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
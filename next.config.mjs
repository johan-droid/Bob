/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/login/github', destination: '/api/auth/github' },
      { source: '/auth/github', destination: '/api/auth/github' },
      { source: '/callback/github', destination: '/api/auth/github/callback' },
      { source: '/auth/github/callback', destination: '/api/auth/github/callback' }
    ];
  },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/landing.html', destination: '/', permanent: true },
      { source: '/user/login.html', destination: '/user/login', permanent: true },
      { source: '/org/login.html', destination: '/org/login', permanent: true },
      { source: '/user/dashboard.html', destination: '/user/dashboard', permanent: true },
      { source: '/org/dashboard.html', destination: '/org/dashboard', permanent: true },
      { source: '/org/settings.html', destination: '/org/settings', permanent: true },
      { source: '/permissions.html', destination: '/permissions', permanent: true },
      { source: '/docs.html', destination: '/docs', permanent: true },
      { source: '/privacy.html', destination: '/privacy', permanent: true },
      { source: '/error.html', destination: '/error', permanent: true },
      { source: '/offline.html', destination: '/offline', permanent: true },
      { source: '/settings', destination: '/org/settings', permanent: true },
      { source: '/dashboard', destination: '/org/dashboard', permanent: true }
    ];
  }
};

export default nextConfig;

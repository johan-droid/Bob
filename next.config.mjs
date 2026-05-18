const backendOrigin = process.env.BACKEND_URL || 'http://localhost:5000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
      { source: '/auth/:path*', destination: `${backendOrigin}/auth/:path*` },
      { source: '/login/:path*', destination: `${backendOrigin}/login/:path*` },
      { source: '/callback/:path*', destination: `${backendOrigin}/callback/:path*` },
      { source: '/icons/:path*', destination: `${backendOrigin}/icons/:path*` },
      { source: '/sw.js', destination: `${backendOrigin}/sw.js` },
      { source: '/manifest.json', destination: `${backendOrigin}/manifest.json` },
      { source: '/offline.html', destination: `${backendOrigin}/offline.html` },
      { source: '/favicon.ico', destination: `${backendOrigin}/favicon.ico` }
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

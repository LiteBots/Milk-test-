/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Typy sprawdzane osobno (npm run typecheck) – build na Railway nie zatrzyma się na ostrzeżeniu typów
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [
      { pathname: '/api/media/**' },
      { pathname: '/img/**' },
      { pathname: '/icons/**' }
    ],
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }]
  },
  experimental: {
    serverActions: { bodySizeLimit: '8mb' }
  },
  async redirects() {
    // Stare adresy z poprzedniej wersji serwisu → nowe (301 dla SEO)
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/menu.html', destination: '/menu', permanent: true },
      { source: '/menu.pdf', destination: '/menu', permanent: false },
      { source: '/app.html', destination: '/app', permanent: true },
      { source: '/apka33.html', destination: '/app', permanent: true },
      { source: '/aplikacja.html', destination: '/aplikacja', permanent: true },
      { source: '/admin.html', destination: '/admin', permanent: true },
      { source: '/manage.html', destination: '/admin', permanent: true },
      { source: '/pkt.html', destination: '/admin/kasa', permanent: true },
      { source: '/kiosk.html', destination: '/admin/kasa', permanent: true },
      { source: '/privacypolicy.html', destination: '/polityka-prywatnosci', permanent: true }
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' }
        ]
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' }
        ]
      }
    ];
  }
};

export default nextConfig;

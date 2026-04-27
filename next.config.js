/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/your-events',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;

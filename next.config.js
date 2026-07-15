// Base path of the deployed site. Defaults to the GitHub Pages project subpath
// (/your-events). Set NEXT_PUBLIC_BASE_PATH='' when moving to a custom domain
// served at root. Keep this in sync with @/config/site (NEXT_PUBLIC_BASE_PATH).
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/your-events';
// Next.js wants basePath either unset or starting with '/', never an empty
// string — treat '' as "no base path" (root domain).
const basePath = rawBasePath === '' ? undefined : rawBasePath;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  typedRoutes: true,
};

module.exports = nextConfig;

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'your-events',
    short_name: 'your-events',
    description:
      'Odkryj najlepsze wydarzenia w Szczecinie — taniec, fitness, warsztaty kulinarne, koncerty i więcej.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/favicons/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/favicons/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/favicons/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

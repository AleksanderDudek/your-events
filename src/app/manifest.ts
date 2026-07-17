import type { MetadataRoute } from 'next';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { DEFAULT_CITY_ID, getCity } from '@/config/cities';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const m = messages[DEFAULT_LOCALE];
  const cityLocative = getCity(DEFAULT_CITY_ID).locativeForm[DEFAULT_LOCALE];
  return {
    name: m.APP_NAME,
    short_name: m.APP_NAME,
    description: m.META_DESCRIPTION(cityLocative),
    start_url: '/your-events/',
    display: 'standalone',
    background_color: '#fbf8f3',
    theme_color: '#f4553b',
    icons: [
      {
        src: '/your-events/favicons/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/your-events/favicons/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/your-events/favicons/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

import { MetadataRoute } from 'next';

import { AVAILABLE_CITIES } from '@/config/cities';
import { SITE_URL } from '@/config/site';
import { getSupabaseForCity } from '@/lib/supabase';

export const dynamic = 'force-static';

// Mirrors generateStaticParams in app/events/[id]/page.tsx: union event ids
// across every available city so the sitemap lists exactly the detail pages
// that get pre-rendered at build time. Keep both in sync — a page that exists
// but is absent here is invisible to crawlers; a url here without a page 404s.
async function getEventIds(): Promise<string[]> {
  const ids = new Set<string>();
  for (const city of AVAILABLE_CITIES) {
    const supabase = getSupabaseForCity(city.id);
    const { data } = await supabase.from('events').select('id');
    for (const row of (data ?? []) as Array<{ id: number }>) {
      ids.add(String(row.id));
    }
  }
  return Array.from(ids);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/events`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const eventRoutes: MetadataRoute.Sitemap = (await getEventIds()).map((id) => ({
    url: `${SITE_URL}/events/${id}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...eventRoutes];
}

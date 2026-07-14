import { MetadataRoute } from 'next';
import { AVAILABLE_CITIES } from '@/config/cities';
import { SITE_URL } from '@/config/site';
import { getCityEvents, fetchCategories } from '@/components/service/eventsApi';
import { buildCategorySlugMap, resolveCategorySlug, eventPath } from '@/lib/slug';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const map = buildCategorySlugMap(await fetchCategories());

  const routes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: 'daily', priority: 1 },
  ];

  for (const city of AVAILABLE_CITIES) {
    routes.push({ url: `${SITE_URL}/${city.id}`, lastModified, changeFrequency: 'daily', priority: 0.9 });
    routes.push({ url: `${SITE_URL}/${city.id}/wydarzenia`, lastModified, changeFrequency: 'daily', priority: 0.8 });

    const events = await getCityEvents(city.id);
    const hubSlugs = new Set(events.map((e) => resolveCategorySlug(e.categoryMain, map)));
    for (const slug of hubSlugs) {
      routes.push({ url: `${SITE_URL}/${city.id}/${slug}`, lastModified, changeFrequency: 'daily', priority: 0.7 });
    }
    for (const e of events) {
      routes.push({
        url: `${SITE_URL}${eventPath(city.id, e, map)}`,
        lastModified: ((): Date => {
          if (!e.updatedAt) return lastModified;
          const d = new Date(e.updatedAt);
          return Number.isNaN(d.getTime()) ? lastModified : d;
        })(),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }
  return routes;
}

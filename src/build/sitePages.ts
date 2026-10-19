import { AVAILABLE_CITIES } from '@/config/cities';
import { getCategories, getCityEvents } from '@/components/service/eventsApi';
import { buildCategorySlugMap, eventPath, resolveCategorySlug } from '@/lib/slug';

export interface CityPages {
  cityId: string;
  /** Category hub paths: /{city}/{category}. */
  hubs: string[];
  /** Event permalinks: /{city}/{category}/{name}-{shortid}. */
  events: Array<{ path: string; updatedAt: string | null }>;
}

/**
 * Every data-driven page of every live city, derived from the same rows (and
 * the same slug rules) the pages themselves render from.
 *
 * One source for both the prerender list and the sitemap, so the sitemap can
 * never advertise a page the build did not write — or miss one it did.
 * getCityEvents caches per build, so the hub and detail loaders that run next
 * read the same snapshot without another query.
 */
export async function collectCityPages(): Promise<CityPages[]> {
  const slugMap = buildCategorySlugMap(await getCategories());
  const pages: CityPages[] = [];
  for (const city of AVAILABLE_CITIES) {
    const events = await getCityEvents(city.id);
    const hubSlugs = new Set(events.map((e) => resolveCategorySlug(e.categoryMain, slugMap)));
    pages.push({
      cityId: city.id,
      hubs: [...hubSlugs].map((slug) => `/${city.id}/${slug}`),
      events: events.map((e) => ({ path: eventPath(city.id, e, slugMap), updatedAt: e.updatedAt })),
    });
  }
  return pages;
}

import { data } from 'react-router';
import CategoryHubView from '@/components/views/CategoryHubView/CategoryHubView';
import { getCategories, getCityEvents } from '@/components/service/eventsApi';
import { getCity, isCityId } from '@/config/cities';
import { cityEventsSeo } from '@/lib/cityMeta';
import { buildMeta } from '@/lib/seo';
import { buildCategorySlugMap, resolveCategorySlug } from '@/lib/slug';
import type { Route } from './+types/category-hub';

const HUB_LIMIT = 48;

// Runs at build time only (the site has no server), once per prerendered hub.
// getCityEvents caches per build, so every hub of a city shares one query.
export async function loader({ params }: Route.LoaderArgs) {
  const { city, category } = params;
  if (!isCityId(city) || !getCity(city).available) throw data(null, { status: 404 });

  const categories = await getCategories();
  const slugMap = buildCategorySlugMap(categories);
  const events = (await getCityEvents(city)).filter(
    (e) => resolveCategorySlug(e.categoryMain, slugMap) === category
  );
  if (events.length === 0) throw data(null, { status: 404 });

  const categoryName =
    categories.find((c) => c.slug === category && c.parent_slug === null)?.display_name ?? category;
  return { city, category, categoryName, events: events.slice(0, HUB_LIMIT) };
}

// Client navigation, and a boot from 404.html, read the prerendered data file
// through this. Without a clientLoader, React Router never requests that file
// when the app starts at a path the build did not write — an event added since
// the last build — and fails with an internal error instead of the 404 the
// missing file means.
export const clientLoader = ({ serverLoader }: Route.ClientLoaderArgs) => serverLoader();

export const meta = ({ loaderData: hub, params }: Route.MetaArgs) => {
  const { cityId, title, description } = cityEventsSeo(params.city);
  if (!hub) return buildMeta({ robots: 'noindex' });
  return buildMeta({
    title: `${hub.categoryName} — ${title}`,
    description,
    canonicalPath: `/${cityId}/${hub.category}`,
  });
};

export default function CategoryHubPage({ loaderData }: Route.ComponentProps) {
  return (
    <CategoryHubView
      citySlug={loaderData.city}
      categorySlug={loaderData.category}
      categoryName={loaderData.categoryName}
      events={loaderData.events}
    />
  );
}

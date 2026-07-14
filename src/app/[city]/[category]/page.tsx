import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCityEvents, fetchCategories } from '@/components/service/eventsApi';
import { buildCategorySlugMap, resolveCategorySlug } from '@/lib/slug';
import { AVAILABLE_CITIES, getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';
import CategoryHubView from '@/components/views/CategoryHubView/CategoryHubView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { SITE_URL } from '@/config/site';

export const dynamicParams = false;
const HUB_LIMIT = 48;

async function slugMap() {
  return buildCategorySlugMap(await fetchCategories());
}

async function categoryName(categorySlug: string): Promise<string> {
  const cats = await fetchCategories();
  return cats.find((c) => c.slug === categorySlug && c.parent_slug === null)?.display_name ?? categorySlug;
}

export async function generateStaticParams() {
  const map = await slugMap();
  const params: Array<{ city: string; category: string }> = [];
  for (const city of AVAILABLE_CITIES) {
    const events = await getCityEvents(city.id);
    const slugs = new Set(events.map((e) => resolveCategorySlug(e.categoryMain, map)));
    for (const category of slugs) params.push({ city: city.id, category });
  }
  return params;
}

interface HubProps {
  params: Promise<Readonly<{ city: string; category: string }>>;
}

export async function generateMetadata({ params }: HubProps): Promise<Metadata> {
  const { city, category } = await params;
  const cityId = isCityId(city) ? city : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  const name = await categoryName(category);
  return {
    title: `${name} — ${messages[DEFAULT_LOCALE].META_EVENTS_TITLE(locative)}`,
    description: messages[DEFAULT_LOCALE].META_DESCRIPTION(locative),
    alternates: { canonical: `${SITE_URL}/${cityId}/${category}` },
  };
}

export default async function CategoryHubPage({ params }: HubProps) {
  const { city, category } = await params;
  if (!isCityId(city)) notFound();
  const map = await slugMap();
  const events = (await getCityEvents(city)).filter(
    (e) => resolveCategorySlug(e.categoryMain, map) === category
  );
  if (events.length === 0) notFound();
  return (
    <CategoryHubView
      citySlug={city}
      categorySlug={category}
      categoryName={await categoryName(category)}
      events={events.slice(0, HUB_LIMIT)}
    />
  );
}

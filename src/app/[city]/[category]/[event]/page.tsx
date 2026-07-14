import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCityEvents, fetchCategories } from '@/components/service/eventsApi';
import { buildCategorySlugMap, resolveCategorySlug, shortId, nameSlug } from '@/lib/slug';
import { AVAILABLE_CITIES, getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';
import EventDetailView from '@/components/views/EventDetailView/EventDetailView';
import { Event } from '@/types/event.types';
import { SITE_URL } from '@/config/site';

export const dynamicParams = false;

function idFromSlug(slug: string): string {
  return slug.slice(slug.lastIndexOf('-') + 1);
}

async function resolveEvent(cityId: string, eventSlug: string): Promise<Event | null> {
  const id = idFromSlug(eventSlug);
  const events = await getCityEvents(cityId);
  return events.find((e) => shortId(e.eventKey) === id) ?? null;
}

export async function generateStaticParams() {
  const map = buildCategorySlugMap(await fetchCategories());
  const params: Array<{ city: string; category: string; event: string }> = [];
  for (const city of AVAILABLE_CITIES) {
    for (const e of await getCityEvents(city.id)) {
      params.push({
        city: city.id,
        category: resolveCategorySlug(e.categoryMain, map),
        event: `${nameSlug(e.name)}-${shortId(e.eventKey)}`,
      });
    }
  }
  return params;
}

interface DetailProps {
  params: Promise<Readonly<{ city: string; category: string; event: string }>>;
}

export async function generateMetadata({ params }: DetailProps): Promise<Metadata> {
  const { city, category, event } = await params;
  if (!isCityId(city)) return { title: 'Wydarzenie nie znalezione' };
  const found = await resolveEvent(city, event);
  if (!found) return { title: 'Wydarzenie nie znalezione' };
  return {
    title: `${found.name} — ${found.date}`,
    description: found.description.slice(0, 160),
    alternates: { canonical: `${SITE_URL}/${city}/${category}/${event}` },
  };
}

export default async function EventDetailPage({ params }: DetailProps) {
  const { city, event } = await params;
  if (!isCityId(city)) notFound();
  const found = await resolveEvent(city, event);
  if (!found) notFound();

  const cityName = getCity(isCityId(city) ? city : DEFAULT_CITY_ID).displayName.pl;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: found.name,
    description: found.description,
    ...(found.imageUrl && { image: found.imageUrl }),
    startDate: `${found.date}T${found.startTime}:00`,
    ...(found.endTime && { endDate: `${found.date}T${found.endTime}:00` }),
    location: {
      '@type': 'Place',
      name: found.location.name,
      address: { '@type': 'PostalAddress', addressLocality: cityName },
    },
    ...(found.price.amount !== null && {
      offers: { '@type': 'Offer', price: found.price.amount, priceCurrency: found.price.currency },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escape '<' so an event name containing "</script>" cannot break out of
        // the inline JSON-LD block (XSS-safe serialization of trusted data).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <EventDetailView event={found} />
    </>
  );
}

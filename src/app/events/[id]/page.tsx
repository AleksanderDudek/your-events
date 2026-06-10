import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchEvent } from '@/components/service/eventsApi';
import EventDetailView from '@/components/views/EventDetailView/EventDetailView';
import { NotFoundError } from '@/lib/utils';
import { AVAILABLE_CITIES, DEFAULT_CITY_ID } from '@/config/cities';
import { getSupabaseForCity } from '@/lib/supabase';

import EventDetailLoading from './loading';

export const dynamicParams = false;

export async function generateStaticParams() {
  // Static export pre-renders one route per event id. With per-city Supabase
  // projects we union ids across all available cities. Id collisions across
  // projects are rare in practice (each project autoincrements its own
  // sequence), but if they happen later we can switch to /events/[city]/[id].
  const ids = new Set<string>();
  for (const city of AVAILABLE_CITIES) {
    const supabase = getSupabaseForCity(city.id);
    const { data } = await supabase.from('events').select('id');
    for (const row of (data ?? []) as Array<{ id: number }>) {
      ids.add(String(row.id));
    }
  }
  return Array.from(ids).map((id) => ({ id }));
}

interface EventDetailPageProps {
  params: Promise<Readonly<{ id: string }>>;
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    // Build-time metadata uses the default-city project; client-side detail
    // queries go through useEvent (city-aware via CityProvider).
    const event = await fetchEvent(DEFAULT_CITY_ID, id);
    return {
      title: `${event.name} — ${event.date}`,
      description: event.description.slice(0, 160),
    };
  } catch {
    return {
      title: 'Wydarzenie nie znalezione',
    };
  }
}

async function EventDetailContent({ id }: Readonly<{ id: string }>) {
  let event;
  try {
    event = await fetchEvent(DEFAULT_CITY_ID, id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    ...(event.imageUrl && { image: event.imageUrl }),
    startDate: `${event.date}T${event.startTime}:00`,
    ...(event.endTime && { endDate: `${event.date}T${event.endTime}:00` }),
    location: {
      '@type': 'Place',
      name: event.location.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: event.location.city,
      },
    },
    ...(event.price.amount !== null && {
      offers: {
        '@type': 'Offer',
        price: event.price.amount,
        priceCurrency: event.price.currency,
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EventDetailView event={event} />
    </>
  );
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<EventDetailLoading />}>
      <EventDetailContent id={id} />
    </Suspense>
  );
}

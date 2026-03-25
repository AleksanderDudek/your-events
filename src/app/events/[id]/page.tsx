import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchEvent } from '@/components/service/eventsApi';
import EventDetailView from '@/components/views/EventDetailView/EventDetailView';
import { NotFoundError } from '@/lib/utils';

import EventDetailLoading from './loading';

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const event = await fetchEvent(id);
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

async function EventDetailContent({ id }: { id: string }) {
  let event;
  try {
    event = await fetchEvent(id);
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
    startDate: `${event.date}T${event.startTime}:00`,
    endDate: `${event.date}T${event.endTime}:00`,
    location: {
      '@type': 'Place',
      name: event.location.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.location.address,
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

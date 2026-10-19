import type { Event } from '@/types/event.types';

/** schema.org Event markup for an event page, so search results can show it as one. */
export function eventJsonLd(event: Event, cityName: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    ...(event.imageUrl && { image: event.imageUrl }),
    // schema.org accepts a bare date when no clock time is known — scraped rows
    // without a usable time_start reach here with startTime ''.
    startDate: event.startTime ? `${event.date}T${event.startTime}:00` : event.date,
    ...(event.startTime && event.endTime && { endDate: `${event.date}T${event.endTime}:00` }),
    location: {
      '@type': 'Place',
      name: event.location.name,
      address: { '@type': 'PostalAddress', addressLocality: cityName },
    },
    ...(event.price.amount !== null && {
      offers: { '@type': 'Offer', price: event.price.amount, priceCurrency: event.price.currency },
    }),
  };
}

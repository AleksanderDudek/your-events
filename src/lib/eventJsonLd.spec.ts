import { describe, it, expect } from 'vitest';
import { eventJsonLd } from './eventJsonLd';
import type { Event } from '@/types/event.types';

const base: Event = {
  id: '1',
  eventKey: 'k',
  name: 'Jazz Jam',
  description: 'Wieczór jazzowy',
  categoryMain: 'Muzyka',
  categorySub: '',
  date: '2026-10-20',
  startTime: '19:00',
  endTime: '22:00',
  durationMin: null,
  location: { name: 'Klub Vertigo', city: 'Wrocław', lat: null, lng: null },
  price: { amount: 30, currency: 'PLN', label: '', showLabel: false },
  url: '',
  imageUrl: 'https://img.test/a.jpg',
  sources: [],
  updatedAt: null,
};

describe('eventJsonLd', () => {
  it('describes the event as a schema.org Event at its venue', () => {
    expect(eventJsonLd(base, 'Wrocław')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Jazz Jam',
      description: 'Wieczór jazzowy',
      image: 'https://img.test/a.jpg',
      startDate: '2026-10-20T19:00:00',
      endDate: '2026-10-20T22:00:00',
      location: {
        '@type': 'Place',
        name: 'Klub Vertigo',
        address: { '@type': 'PostalAddress', addressLocality: 'Wrocław' },
      },
      offers: { '@type': 'Offer', price: 30, priceCurrency: 'PLN' },
    });
  });

  // schema.org accepts a bare date when no clock time is known — scraped rows
  // without a usable time_start reach here with startTime ''.
  it('falls back to a bare date and drops what is unknown', () => {
    const ld = eventJsonLd(
      { ...base, startTime: '', endTime: '', imageUrl: '', price: { ...base.price, amount: null } },
      'Wrocław'
    );
    expect(ld.startDate).toBe('2026-10-20');
    expect(ld).not.toHaveProperty('endDate');
    expect(ld).not.toHaveProperty('image');
    expect(ld).not.toHaveProperty('offers');
  });
});

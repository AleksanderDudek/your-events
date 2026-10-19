import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Event } from '@/types/event.types';

const { getCityEvents, getCategories } = vi.hoisted(() => ({
  getCityEvents: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock('@/components/service/eventsApi', () => ({ getCityEvents, getCategories }));

// Two live cities, so the per-city loop is exercised without depending on env.
vi.mock('@/config/cities', () => ({
  AVAILABLE_CITIES: [{ id: 'wroclaw' }, { id: 'szczecin' }],
}));

import { shortId } from '@/lib/slug';
import { collectCityPages } from './sitePages';
import { prerenderPaths, STATIC_PATHS } from './prerenderPaths';

function event(overrides: Partial<Event>): Event {
  return {
    id: '1',
    eventKey: 'aaaaaaaa-0000-0000-0000-000000000000',
    name: 'Jazz Jam',
    description: '',
    categoryMain: 'Muzyka',
    categorySub: '',
    date: '2026-10-20',
    startTime: '19:00',
    endTime: '',
    durationMin: null,
    location: { name: 'Klub', city: 'Wrocław', lat: null, lng: null },
    price: { amount: null, currency: 'PLN', label: '', showLabel: false },
    url: '',
    imageUrl: '',
    sources: [],
    updatedAt: '2026-10-19T08:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  getCategories.mockResolvedValue([
    { slug: 'muzyka', display_name: 'Muzyka', parent_slug: null },
    { slug: 'film', display_name: 'Film', parent_slug: null },
  ]);
  getCityEvents.mockImplementation(async (cityId: string) =>
    cityId === 'wroclaw'
      ? [
          event({ eventKey: '11111111-x', name: 'Jazz Jam' }),
          event({ eventKey: '22222222-x', name: 'Kino nocą', categoryMain: 'Film', updatedAt: null }),
          // An unmapped category still gets a page, under the fallback hub.
          event({ eventKey: '33333333-x', name: 'Coś', categoryMain: 'Nieznana' }),
        ]
      : []
  );
});

describe('collectCityPages', () => {
  it('derives each city’s hubs and event permalinks from its events', async () => {
    const [wroclaw, szczecin] = await collectCityPages();

    expect(wroclaw.cityId).toBe('wroclaw');
    expect(wroclaw.hubs).toEqual(['/wroclaw/muzyka', '/wroclaw/film', '/wroclaw/inne']);
    expect(wroclaw.events).toEqual([
      { path: `/wroclaw/muzyka/jazz-jam-${shortId('11111111-x')}`, updatedAt: '2026-10-19T08:00:00Z' },
      { path: `/wroclaw/film/kino-noca-${shortId('22222222-x')}`, updatedAt: null },
      { path: `/wroclaw/inne/cos-${shortId('33333333-x')}`, updatedAt: '2026-10-19T08:00:00Z' },
    ]);

    // A city without events still has its landing and list pages, but no hubs.
    expect(szczecin).toEqual({ cityId: 'szczecin', hubs: [], events: [] });
  });
});

describe('prerenderPaths', () => {
  it('lists the static pages, the SEO files and every city page once', async () => {
    const paths = await prerenderPaths();

    expect(paths).toEqual(expect.arrayContaining(['/', '/moje-filtry/', '/prywatnosc/', '/rozwijaj-z-nami/']));
    expect(paths).toEqual(expect.arrayContaining(['/sitemap.xml', '/robots.txt']));
    expect(paths).toEqual(
      expect.arrayContaining([
        '/wroclaw/',
        '/wroclaw/wydarzenia/',
        '/wroclaw/muzyka/',
        `/wroclaw/muzyka/jazz-jam-${shortId('11111111-x')}/`,
        '/szczecin/',
        '/szczecin/wydarzenia/',
      ])
    );
    expect(new Set(paths).size).toBe(paths.length);
  });

  // React Router names a page's loader-data file after the URL it is asked for:
  // /a/b/ → /a/b/_.data, /a/b → /a/b.data. Every link in the app and every URL
  // GitHub Pages settles on ends in a slash, so the files must be written for
  // that form — the slash-less one 404s on the first client-side navigation.
  it('writes every page under its trailing-slash URL', async () => {
    // Everything but the two resource files (sitemap.xml, robots.txt).
    const pages = (await prerenderPaths()).filter((p) => !/\.[a-z]+$/.test(p));
    expect(pages.length).toBeGreaterThan(STATIC_PATHS.length);
    for (const p of pages) expect(p.endsWith('/')).toBe(true);
  });
});

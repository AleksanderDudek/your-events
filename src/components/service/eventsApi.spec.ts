import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchEvents,
  fetchEvent,
  fetchCategories,
  fetchMapEvents,
  MAP_EVENT_LIMIT,
} from './eventsApi';
import { getSupabaseForCity } from '@/lib/supabase';
import { NotFoundError, ServerError } from '@/lib/utils';
import type { EventFilters } from '@/types/filter.types';

vi.mock('@/lib/supabase', () => ({ getSupabaseForCity: vi.fn() }));

const getSupabaseForCityMock = vi.mocked(getSupabaseForCity);

// ── Test doubles ─────────────────────────────────────────────────────────────

type ListResult = { data: unknown[] | null; count: number | null; error: { message: string; code?: string } | null };
type SingleResult = { data: unknown | null; error: { message: string; code?: string } | null };

// The PostgREST filter/order/range methods eventsApi chains. Each is a spy that
// returns the builder, so we can assert exactly which query was constructed.
const QUERY_METHODS = [
  'select',
  'in',
  'or',
  'eq',
  'gte',
  'lte',
  'order',
  'range',
  // The map query narrows to rows that can become a pin, and caps the response.
  'not',
  'limit',
] as const;
type QueryMethod = (typeof QUERY_METHODS)[number];
type Builder = Record<QueryMethod, ReturnType<typeof vi.fn>> & {
  single: ReturnType<typeof vi.fn>;
  // Makes the builder awaitable: `await query` resolves the list result.
  then: (onF: (v: ListResult) => unknown, onR?: (e: unknown) => unknown) => Promise<unknown>;
};

function makeBuilder(list: () => ListResult, single: () => SingleResult): Builder {
  const b = {} as Builder;
  for (const m of QUERY_METHODS) b[m] = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve(single()));
  b.then = (onF, onR) => Promise.resolve(list()).then(onF, onR);
  return b;
}

interface DbEventRow {
  id: number;
  event_key: string;
  source: string;
  sources: string;
  venue: string;
  date: string;
  time_start: string;
  time_end: string;
  duration_min: number | null;
  name: string;
  description: string;
  url: string;
  all_urls: string;
  category_main: string;
  category_sub: string;
  price: number | null;
  price_max: number | null;
  price_label: string;
  is_free: boolean;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  scraped_at: string;
  updated_at: string;
}

function makeRow(overrides: Partial<DbEventRow> = {}): DbEventRow {
  return {
    id: 101,
    event_key: 'evt-101',
    source: 'Kimama',
    sources: '["Kimama"]',
    venue: 'Kimama Dance Studio',
    date: '2026-03-01',
    time_start: '18:00',
    time_end: '19:00',
    duration_min: 60,
    name: 'Hip Hop Choreo',
    description: 'Zajęcia hip hop',
    url: 'https://example.com/evt-101',
    all_urls: '[]',
    category_main: 'dance',
    category_sub: 'dance-hip-hop',
    price: 40,
    price_max: null,
    price_label: '40 zł',
    is_free: false,
    lat: 53.42,
    lng: 14.55,
    image_url: 'https://img/evt-101.jpg',
    scraped_at: '2026-02-20T10:00:00Z',
    updated_at: '2026-02-21T10:00:00Z',
    ...overrides,
  };
}

function makeFilters(overrides: Partial<EventFilters> = {}): EventFilters {
  return {
    search: '',
    categories: [],
    dateMode: null,
    dateSingle: null,
    dateFrom: null,
    dateTo: null,
    weekdays: [],
    hourFrom: null,
    hourTo: null,
    freeOnly: false,
    page: 1,
    pageSize: 15,
    viewMode: 'grid',
    sort: 'mix',
    dir: 'asc',
    ...overrides,
  };
}

function setup() {
  const results = {
    events: { data: [], count: 0, error: null } as ListResult,
    single: { data: null, error: null } as SingleResult,
    categories: { data: [], count: null, error: null } as ListResult,
  };

  let eventsBuilder!: Builder;
  let categoriesBuilder!: Builder;

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'categories') {
        categoriesBuilder = makeBuilder(() => results.categories, () => ({ data: null, error: null }));
        return categoriesBuilder;
      }
      eventsBuilder = makeBuilder(() => results.events, () => results.single);
      return eventsBuilder;
    }),
  };
  getSupabaseForCityMock.mockReturnValue(client as unknown as SupabaseClient);

  return {
    client,
    results,
    get eventsBuilder() {
      return eventsBuilder;
    },
    get categoriesBuilder() {
      return categoriesBuilder;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('eventsApi', () => {
  describe('fetchEvent', () => {
    it('maps a db row into the domain Event shape', async () => {
      const s = setup();
      s.results.single = { data: makeRow(), error: null };

      const event = await fetchEvent('szczecin', '101');

      expect(event).toEqual({
        id: '101',
        eventKey: 'evt-101',
        name: 'Hip Hop Choreo',
        description: 'Zajęcia hip hop',
        categoryMain: 'dance',
        categorySub: 'dance-hip-hop',
        date: '2026-03-01',
        startTime: '18:00',
        endTime: '19:00',
        durationMin: 60,
        location: { name: 'Kimama Dance Studio', city: 'Szczecin', lat: 53.42, lng: 14.55 },
        price: { amount: 40, currency: 'PLN', label: '40 zł', showLabel: false },
        url: 'https://example.com/evt-101',
        imageUrl: 'https://img/evt-101.jpg',
        sources: ['Kimama'],
        updatedAt: '2026-02-21T10:00:00Z',
      });
    });

    it('queries the events table by numeric id via .single()', async () => {
      const s = setup();
      s.results.single = { data: makeRow(), error: null };

      await fetchEvent('szczecin', '101');

      expect(s.client.from).toHaveBeenCalledWith('events');
      expect(s.eventsBuilder.eq).toHaveBeenCalledWith('id', 101);
      expect(s.eventsBuilder.single).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when the row is missing (PGRST116)', async () => {
      const s = setup();
      s.results.single = { data: null, error: { code: 'PGRST116', message: 'no rows' } };

      await expect(fetchEvent('szczecin', '999')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ServerError (with the db message) on other errors', async () => {
      const s = setup();
      s.results.single = { data: null, error: { code: '42P01', message: 'relation missing' } };

      await expect(fetchEvent('szczecin', '1')).rejects.toBeInstanceOf(ServerError);
      await expect(fetchEvent('szczecin', '1')).rejects.toThrow('relation missing');
    });

    describe('price mapping', () => {
      it('treats is_free rows as amount 0', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ is_free: true, price: null, price_label: '' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.price.amount).toBe(0);
        expect(event.price.showLabel).toBe(false);
      });

      it('shows the label for descriptive membership pricing', async () => {
        const s = setup();
        s.results.single = {
          data: makeRow({ price: null, is_free: false, price_label: 'Karnet od 189 zł' }),
          error: null,
        };

        const event = await fetchEvent('szczecin', '1');

        expect(event.price.amount).toBe(189);
        expect(event.price.showLabel).toBe(true);
      });

      it('does not show the label for a bare numeric price label', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ price: null, is_free: false, price_label: '40 zł' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.price.amount).toBe(40);
        expect(event.price.showLabel).toBe(false);
      });

      it('rejects a price parsed out of a URL fragment', async () => {
        const s = setup();
        s.results.single = {
          data: makeRow({ price: null, is_free: false, price_label: 'https://kupbilecik.pl/?price=196331' }),
          error: null,
        };

        const event = await fetchEvent('szczecin', '1');

        expect(event.price.amount).toBeNull();
        expect(event.price.showLabel).toBe(false);
      });

      it('detects free-text pricing ("bezpłatne") as amount 0', async () => {
        const s = setup();
        s.results.single = {
          data: makeRow({ price: null, is_free: false, price_label: 'Wstęp bezpłatny' }),
          error: null,
        };

        const event = await fetchEvent('szczecin', '1');

        expect(event.price.amount).toBe(0);
      });
    });

    describe('sources parsing', () => {
      it('parses a JSON-encoded array of sources', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ sources: '["Multikino","Going"]' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.sources).toEqual(['Multikino', 'Going']);
      });

      it('falls back to the bare source when sources is not JSON', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ sources: 'not-json', source: 'Facebook' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.sources).toEqual(['Facebook']);
      });

      it('falls back to the source when the JSON array is empty', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ sources: '[]', source: 'Facebook' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.sources).toEqual(['Facebook']);
      });

      it('returns an empty array when there is no source at all', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ sources: '', source: '' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.sources).toEqual([]);
      });
    });
  });

  describe('fetchEvents', () => {
    it('returns the mapped events and the total count', async () => {
      const s = setup();
      s.results.events = { data: [makeRow(), makeRow({ id: 102 })], count: 2, error: null };

      const { events, total } = await fetchEvents('szczecin', makeFilters());

      expect(events.map((e) => e.id)).toEqual(['101', '102']);
      expect(total).toBe(2);
    });

    it('defaults total to 0 when the count is null', async () => {
      const s = setup();
      s.results.events = { data: [], count: null, error: null };

      const { total } = await fetchEvents('szczecin', makeFilters());

      expect(total).toBe(0);
    });

    it('requests the correct page range', async () => {
      const s = setup();

      await fetchEvents('szczecin', makeFilters({ page: 2, pageSize: 15 }));

      // from = (2 - 1) * 15 = 15, to = 15 + 15 - 1 = 29
      expect(s.eventsBuilder.range).toHaveBeenCalledWith(15, 29);
    });
  });

  describe('fetchMapEvents', () => {
    it('never pages — a map is one view of the whole result, not page N of it', async () => {
      const s = setup();

      await fetchMapEvents('szczecin', makeFilters({ page: 3, pageSize: 15 }));

      expect(s.eventsBuilder.range).not.toHaveBeenCalled();
      expect(s.eventsBuilder.limit).toHaveBeenCalledWith(MAP_EVENT_LIMIT);
    });

    it('excludes rows with no coordinates in the query, not after the fact', async () => {
      // They can never become a pin, and fetching them would spend the row
      // budget on events the map cannot show.
      const s = setup();

      await fetchMapEvents('szczecin', makeFilters());

      expect(s.eventsBuilder.not).toHaveBeenCalledWith('lat', 'is', null);
      expect(s.eventsBuilder.not).toHaveBeenCalledWith('lng', 'is', null);
    });

    it('applies the same filters as the list, so the two cannot disagree', async () => {
      const s = setup();

      await fetchMapEvents('szczecin', makeFilters({ search: 'jazz', dateFrom: '2026-03-01' }));

      expect(s.eventsBuilder.or).toHaveBeenCalledWith(
        expect.stringContaining('name.ilike')
      );
      expect(s.eventsBuilder.gte).toHaveBeenCalledWith('date', '2026-03-01');
    });

    it('reports the count of mappable matches', async () => {
      const s = setup();
      s.results.events = { data: [makeRow(), makeRow({ id: 102 })], count: 572, error: null };

      const { events, total } = await fetchMapEvents('szczecin', makeFilters());

      expect(events.map((e) => e.id)).toEqual(['101', '102']);
      expect(total).toBe(572);
    });

    it('recomputes the total when freeOnly is applied client-side', async () => {
      // freeOnly has no column to filter on, so the server count would be wrong.
      const s = setup();
      s.results.events = {
        data: [makeRow({ is_free: true }), makeRow({ id: 102, is_free: false, price: 40 })],
        count: 2,
        error: null,
      };

      const { events, total } = await fetchMapEvents('szczecin', makeFilters({ freeOnly: true }));

      expect(events).toHaveLength(1);
      expect(total).toBe(1);
    });

    it('matches a search term against both the event name and the venue', async () => {
      const s = setup();

      await fetchEvents('szczecin', makeFilters({ search: 'jazz' }));

      expect(s.eventsBuilder.or).toHaveBeenCalledWith('name.ilike."%jazz%",venue.ilike."%jazz%"');
    });

    it('quotes a multi-word search term so commas and spaces do not split the OR group', async () => {
      const s = setup();

      await fetchEvents('szczecin', makeFilters({ search: 'jazz, blues (live)' }));

      expect(s.eventsBuilder.or).toHaveBeenCalledWith(
        'name.ilike."%jazz, blues (live)%",venue.ilike."%jazz, blues (live)%"'
      );
    });

    it('escapes quotes and backslashes in the search term', async () => {
      const s = setup();

      await fetchEvents('szczecin', makeFilters({ search: 'a"b\\c' }));

      expect(s.eventsBuilder.or).toHaveBeenCalledWith(
        'name.ilike."%a\\"b\\\\c%",venue.ilike."%a\\"b\\\\c%"'
      );
    });

    it('keeps the search OR separate from the category OR', async () => {
      const s = setup();

      await fetchEvents('szczecin', makeFilters({ search: 'jazz' }), {
        topLevelMains: [],
        subPairs: [{ main: 'dance', sub: 'dance-hip-hop' }],
      });

      // Two `or=` params — PostgREST ANDs them: (name|venue) AND (category).
      expect(s.eventsBuilder.or).toHaveBeenCalledTimes(2);
      expect(s.eventsBuilder.or).toHaveBeenCalledWith('name.ilike."%jazz%",venue.ilike."%jazz%"');
      expect(s.eventsBuilder.or).toHaveBeenCalledWith(
        'and(category_main.eq."dance",category_sub.eq."dance-hip-hop")'
      );
    });

    it('orders by date then time_start', async () => {
      const s = setup();

      await fetchEvents('szczecin', makeFilters());

      expect(s.eventsBuilder.order).toHaveBeenCalledWith('date');
      expect(s.eventsBuilder.order).toHaveBeenCalledWith('time_start');
    });

    describe('category filtering', () => {
      it('uses .in for top-level categories only', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters(), { topLevelMains: ['dance', 'music'], subPairs: [] });

        expect(s.eventsBuilder.in).toHaveBeenCalledWith('category_main', ['dance', 'music']);
        expect(s.eventsBuilder.or).not.toHaveBeenCalled();
      });

      it('builds an OR query for a sub-category pair', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters(), {
          topLevelMains: [],
          subPairs: [{ main: 'dance', sub: 'dance-hip-hop' }],
        });

        expect(s.eventsBuilder.or).toHaveBeenCalledWith(
          'and(category_main.eq."dance",category_sub.eq."dance-hip-hop")'
        );
        expect(s.eventsBuilder.in).not.toHaveBeenCalled();
      });

      it('combines top-level mains and sub-pairs into one OR', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters(), {
          topLevelMains: ['music'],
          subPairs: [{ main: 'dance', sub: 'dance-hip-hop' }],
        });

        expect(s.eventsBuilder.or).toHaveBeenCalledWith(
          'category_main.in.("music"),and(category_main.eq."dance",category_sub.eq."dance-hip-hop")'
        );
      });
    });

    describe('date & hour filtering', () => {
      it('filters by a single date', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ dateSingle: '2026-03-01' }));

        expect(s.eventsBuilder.eq).toHaveBeenCalledWith('date', '2026-03-01');
      });

      it('filters by a date range', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ dateFrom: '2026-03-01', dateTo: '2026-03-31' }));

        expect(s.eventsBuilder.gte).toHaveBeenCalledWith('date', '2026-03-01');
        expect(s.eventsBuilder.lte).toHaveBeenCalledWith('date', '2026-03-31');
      });

      it('applies hour filters only when a date mode is set', async () => {
        const s = setup();

        await fetchEvents(
          'szczecin',
          makeFilters({ dateMode: 'single', hourFrom: '18:00', hourTo: '20:00' })
        );

        expect(s.eventsBuilder.gte).toHaveBeenCalledWith('time_start', '18:00');
        expect(s.eventsBuilder.lte).toHaveBeenCalledWith('time_start', '20:00');
      });

      it('ignores hour filters when no date mode is set', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ dateMode: null, hourFrom: '18:00', hourTo: '20:00' }));

        expect(s.eventsBuilder.gte).not.toHaveBeenCalledWith('time_start', '18:00');
        expect(s.eventsBuilder.lte).not.toHaveBeenCalledWith('time_start', '20:00');
      });
    });

    // The table has no day-of-week column, so the filter is pushed down as the
    // set of dates the chosen weekdays cover. These assert the query the list
    // and the map both send — a client-side pass would silently break paging.
    describe('weekday filtering', () => {
      it('narrows to the matching dates inside the date range', async () => {
        const s = setup();

        await fetchEvents(
          'szczecin',
          makeFilters({ weekdays: [1, 3], dateFrom: '2026-07-27', dateTo: '2026-08-02' })
        );

        expect(s.eventsBuilder.in).toHaveBeenCalledWith('date', [
          '2026-07-27',
          '2026-07-29',
        ]);
      });

      it('sends an empty set when no date in range falls on a chosen day', async () => {
        const s = setup();

        // Mon–Tue filtered to Sundays: the query must match nothing rather than
        // fall through to "no weekday filter at all".
        await fetchEvents(
          'szczecin',
          makeFilters({ weekdays: [0], dateFrom: '2026-07-27', dateTo: '2026-07-28' })
        );

        expect(s.eventsBuilder.in).toHaveBeenCalledWith('date', []);
      });

      it('does not touch the query when no weekday is selected', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ weekdays: [] }));

        expect(s.eventsBuilder.in).not.toHaveBeenCalledWith('date', expect.anything());
      });

      it('does not touch the query when every weekday is selected', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ weekdays: [0, 1, 2, 3, 4, 5, 6] }));

        expect(s.eventsBuilder.in).not.toHaveBeenCalledWith('date', expect.anything());
      });

      it('applies to the map query too, so the pins match the list', async () => {
        const s = setup();

        await fetchMapEvents(
          'szczecin',
          makeFilters({ weekdays: [6], dateFrom: '2026-07-27', dateTo: '2026-08-02' })
        );

        expect(s.eventsBuilder.in).toHaveBeenCalledWith('date', ['2026-08-01']);
      });
    });

    describe('free-only (client-side) filtering', () => {
      it('keeps only free/unknown-price events and reports the filtered total', async () => {
        const s = setup();
        s.results.events = {
          data: [
            makeRow({ id: 1, is_free: true, price: null, price_label: '' }),
            makeRow({ id: 2, is_free: false, price: 50, price_label: '50 zł' }),
            makeRow({ id: 3, is_free: false, price: null, price_label: 'https://tickets/?price=999' }),
          ],
          count: 99,
          error: null,
        };

        const { events, total } = await fetchEvents('szczecin', makeFilters({ freeOnly: true }));

        // id 1 (free) and id 3 (null amount) survive; id 2 (50 zł) is dropped.
        expect(events.map((e) => e.id)).toEqual(['1', '3']);
        // total is the client-filtered length, not the db count.
        expect(total).toBe(2);
      });

      it('does not push pagination to the db when free-only filtering', async () => {
        const s = setup();
        s.results.events = { data: [makeRow({ is_free: true, price: null })], count: 1, error: null };

        await fetchEvents('szczecin', makeFilters({ freeOnly: true }));

        expect(s.eventsBuilder.range).not.toHaveBeenCalled();
      });
    });

    it('throws ServerError when the query fails', async () => {
      const s = setup();
      s.results.events = { data: null, count: null, error: { message: 'connection refused' } };

      await expect(fetchEvents('szczecin', makeFilters())).rejects.toBeInstanceOf(ServerError);
    });
  });

  describe('fetchCategories', () => {
    it('returns active categories ordered by sort_order', async () => {
      const s = setup();
      const rows = [
        { slug: 'dance', parent_slug: null, display_name: 'Taniec', display_plural: 'Taniec', icon: '💃', color: '#ec4899', sort_order: 1 },
      ];
      s.results.categories = { data: rows, count: null, error: null };

      const categories = await fetchCategories();

      expect(categories).toEqual(rows);
      expect(s.client.from).toHaveBeenCalledWith('categories');
      expect(s.categoriesBuilder.eq).toHaveBeenCalledWith('is_active', true);
      expect(s.categoriesBuilder.order).toHaveBeenCalledWith('sort_order');
    });

    it('returns an empty array when data is null', async () => {
      const s = setup();
      s.results.categories = { data: null, count: null, error: null };

      await expect(fetchCategories()).resolves.toEqual([]);
    });

    it('throws ServerError on a query error', async () => {
      const s = setup();
      s.results.categories = { data: null, count: null, error: { message: 'boom' } };

      await expect(fetchCategories()).rejects.toBeInstanceOf(ServerError);
    });
  });
});

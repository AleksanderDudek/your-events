import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchEvents,
  fetchEvent,
  fetchCategories,
  fetchMapEvents,
  fetchOfferedSeasons,
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
  // Seasonal sections: `seasons=cs.{slug}`.
  'contains',
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
    near: null,
    season: null,
    page: 1,
    pageSize: 15,
    viewMode: 'grid',
    sort: 'date',
    dir: 'asc',
    ...overrides,
  };
}

function setup() {
  const results = {
    events: { data: [], count: 0, error: null } as ListResult,
    // Answers for successive events queries, in order — a client-filtered list
    // makes two (the scan, then the page). Falls back to `events` once empty.
    eventsQueue: [] as ListResult[],
    single: { data: null, error: null } as SingleResult,
    categories: { data: [], count: null, error: null } as ListResult,
    seasons: { data: [], count: null, error: null } as ListResult,
  };

  let eventsBuilder!: Builder;
  let categoriesBuilder!: Builder;
  let seasonsBuilder!: Builder;
  const eventsBuilders: Builder[] = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'categories') {
        categoriesBuilder = makeBuilder(() => results.categories, () => ({ data: null, error: null }));
        return categoriesBuilder;
      }
      if (table === 'seasons') {
        seasonsBuilder = makeBuilder(() => results.seasons, () => ({ data: null, error: null }));
        return seasonsBuilder;
      }
      const queued = results.eventsQueue.shift();
      eventsBuilder = makeBuilder(() => queued ?? results.events, () => results.single);
      eventsBuilders.push(eventsBuilder);
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
    /** Every events query made, in order. */
    get eventsBuilders() {
      return eventsBuilders;
    },
    get categoriesBuilder() {
      return categoriesBuilder;
    },
    get seasonsBuilder() {
      return seasonsBuilder;
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

    describe('time normalization', () => {
      // One scraped Zdrofit row carried a whole DOM fragment in time_start.
      // Left as-is it reached warsawToUtc, produced new Date(NaN) and threw
      // during prerender, which aborts the entire static export.
      it('drops a time that is not a clock value', async () => {
        const s = setup();
        s.results.single = {
          data: makeRow({ time_start: '50 min19wolnychShape FunkcjonalnyAnna MorawskaSala duża' }),
          error: null,
        };

        const event = await fetchEvent('szczecin', '1');

        expect(event.startTime).toBe('');
      });

      it('drops an out-of-range time', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ time_start: '25:00', time_end: '19:99' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.startTime).toBe('');
        expect(event.endTime).toBe('');
      });

      it('pads a single-digit hour and drops seconds', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ time_start: '9:05', time_end: '10:30:00' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.startTime).toBe('09:05');
        expect(event.endTime).toBe('10:30');
      });

      it('keeps an empty time empty', async () => {
        const s = setup();
        s.results.single = { data: makeRow({ time_start: '', time_end: '' }), error: null };

        const event = await fetchEvent('szczecin', '1');

        expect(event.startTime).toBe('');
        expect(event.endTime).toBe('');
      });
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

      expect(s.eventsBuilder.order).toHaveBeenCalledWith('date', { ascending: true });
      expect(s.eventsBuilder.order).toHaveBeenCalledWith('time_start', { ascending: true });
    });

    // sort/dir choose the order clause. The list and the map share this
    // builder, so both change together and can never disagree about "first".
    describe('ordering', () => {
      it('orders by date, then time_start, ascending', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'date' }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('date', { ascending: true });
        expect(s.eventsBuilder.order).toHaveBeenCalledWith('time_start', { ascending: true });
      });

      it('reverses both columns for dir: desc', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'date', dir: 'desc' }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('date', { ascending: false });
        expect(s.eventsBuilder.order).toHaveBeenCalledWith('time_start', { ascending: false });
      });

      it('orders by name alone', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'name' }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('name', { ascending: true });
        expect(s.eventsBuilder.order).toHaveBeenCalledTimes(1);
      });

      it('orders by name, descending', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'name', dir: 'desc' }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('name', { ascending: false });
      });

      it('orders by venue alone', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'venue' }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('venue', { ascending: true });
        expect(s.eventsBuilder.order).toHaveBeenCalledTimes(1);
      });

      // Nulls last in BOTH directions: an unknown price is neither the
      // cheapest nor the dearest, and must never head the list.
      it('orders by price with nulls last, ascending', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'price' }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('price', { ascending: true, nullsFirst: false });
      });

      it('orders by price with nulls last, descending too', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'price', dir: 'desc' }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('price', { ascending: false, nullsFirst: false });
      });

      // An unrecognised key must never leave the query unordered: PostgREST
      // would then be free to return rows in any order it liked, and page 2
      // could repeat rows from page 1.
      it('falls back to date order for an unrecognised sort', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ sort: 'mix' as never }));

        expect(s.eventsBuilder.order).toHaveBeenCalledWith('date', { ascending: true });
        expect(s.eventsBuilder.order).toHaveBeenCalledWith('time_start', { ascending: true });
      });
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

    describe('season filtering', () => {
      it('narrows to events tagged with the season', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters({ season: 'halloween' }));

        expect(s.eventsBuilder.contains).toHaveBeenCalledWith('seasons', ['halloween']);
      });

      it('applies to the map, which shares the query builder', async () => {
        const s = setup();

        await fetchMapEvents('szczecin', makeFilters({ season: 'halloween' }));

        expect(s.eventsBuilder.contains).toHaveBeenCalledWith('seasons', ['halloween']);
      });

      it('sends no season clause without one', async () => {
        const s = setup();

        await fetchEvents('szczecin', makeFilters());

        expect(s.eventsBuilder.contains).not.toHaveBeenCalled();
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

      // The database cannot page what the browser filters, so it is never asked
      // for the list page: it is scanned in its own fixed-size pages, and the
      // list page is cut from the ids the scan kept.
      it('scans in fixed-size pages rather than asking the db for the list page', async () => {
        const s = setup();
        s.results.events = { data: [makeRow({ is_free: true, price: null })], count: 1, error: null };

        await fetchEvents('szczecin', makeFilters({ freeOnly: true, page: 2 }));

        expect(s.eventsBuilders[0].range).toHaveBeenCalledWith(0, 999);
        expect(s.eventsBuilders[0].range).not.toHaveBeenCalledWith(15, 29);
      });
    });

    describe('proximity', () => {
      // Wrocław's Rynek; 0.009° of latitude is ~1 km.
      const NEAR = { lat: 51.11, lng: 17.032, radius: 1000, label: null };
      const at = (id: number, dLat: number, dLng: number) =>
        makeRow({ id, lat: 51.11 + dLat, lng: 17.032 + dLng });

      it('narrows the database to the box around the circle', async () => {
        const s = setup();

        await fetchMapEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(s.eventsBuilder.gte).toHaveBeenCalledWith('lat', expect.closeTo(51.101, 3));
        expect(s.eventsBuilder.lte).toHaveBeenCalledWith('lat', expect.closeTo(51.119, 3));
        expect(s.eventsBuilder.gte).toHaveBeenCalledWith('lng', expect.closeTo(17.0177, 3));
        expect(s.eventsBuilder.lte).toHaveBeenCalledWith('lng', expect.closeTo(17.0463, 3));
      });

      it('keeps only the map rows inside the circle, not merely inside the box', async () => {
        const s = setup();
        // 945 m due north: inside. ~1093 m north-east: in the box's corner,
        // outside the circle.
        s.results.events = {
          data: [at(1, 0, 0), at(2, 0.0085, 0), at(3, 0.007, 0.011)],
          count: 3,
          error: null,
        };

        const { events, total } = await fetchMapEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events.map((e) => e.id)).toEqual(['1', '2']);
        expect(total).toBe(2);
      });

      it('scans slim rows, then fetches only the requested page in full', async () => {
        const s = setup();
        const rows = Array.from({ length: 16 }, (_, i) => at(i + 1, i * 0.0001, 0));
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: [...rows].reverse(), count: null, error: null },
        ];

        const { events, total } = await fetchEvents('wroclaw', makeFilters({ near: NEAR, page: 2 }));

        const [scan, hydrate] = s.eventsBuilders;
        expect(scan.select).toHaveBeenCalledWith('id,lat,lng,is_free,price,price_label', undefined);
        expect(scan.range).toHaveBeenCalledWith(0, 999);
        expect(hydrate.in).toHaveBeenCalledWith('id', [16]);
        expect(hydrate.range).not.toHaveBeenCalled();
        expect(events.map((e) => e.id)).toEqual(['16']);
        expect(total).toBe(16);
      });

      it('returns the page in the order the scan found it, whatever order the rows arrive in', async () => {
        const s = setup();
        const rows = [at(1, 0, 0), at(2, 0.001, 0), at(3, 0.002, 0)];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: [rows[2], rows[0], rows[1]], count: null, error: null },
        ];

        const { events } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events.map((e) => e.id)).toEqual(['1', '2', '3']);
      });

      it('keeps scanning while pages come back full', async () => {
        const s = setup();
        const full = Array.from({ length: 1000 }, (_, i) => at(i + 1, 0, 0));
        s.results.eventsQueue = [
          { data: full, count: null, error: null },
          { data: [at(1001, 0, 0)], count: null, error: null },
          { data: full.slice(0, 15), count: null, error: null },
        ];

        const { total } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(total).toBe(1001);
        expect(s.eventsBuilders[0].range).toHaveBeenCalledWith(0, 999);
        expect(s.eventsBuilders[1].range).toHaveBeenCalledWith(1000, 1999);
      });

      // The page cap is a runaway guard; reaching it with pages still full
      // means the count and the paging would be wrong, so it says so.
      it('fails loudly rather than truncate a scan at its page cap', async () => {
        const s = setup();
        const full = Array.from({ length: 1000 }, (_, i) => at(i + 1, 0, 0));
        s.results.eventsQueue = Array.from({ length: 20 }, () => ({ data: full, count: null, error: null }));

        await expect(fetchEvents('wroclaw', makeFilters({ near: NEAR }))).rejects.toBeInstanceOf(
          ServerError
        );
        expect(s.eventsBuilders).toHaveLength(20);
      });

      // Ids churn: the scraper rewrites rows under new ids. One rewrite landing
      // between the scan and the page fetch would empty a page the count still
      // calls full, so the whole read is tried once more.
      it('scans again when the page comes back short, as when ids changed under it', async () => {
        const s = setup();
        const before = [at(1, 0, 0), at(2, 0.001, 0)];
        const after = [at(11, 0, 0), at(12, 0.001, 0)];
        s.results.eventsQueue = [
          { data: before, count: null, error: null },
          { data: [], count: null, error: null },
          { data: after, count: null, error: null },
          { data: after, count: null, error: null },
        ];

        const { events, total } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events.map((e) => e.id)).toEqual(['11', '12']);
        expect(total).toBe(2);
        expect(s.eventsBuilders).toHaveLength(4);
      });

      it('settles for a short page once a fresh scan agrees a row is gone', async () => {
        const s = setup();
        const rows = [at(1, 0, 0), at(2, 0.001, 0)];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: [rows[0]], count: null, error: null },
          { data: rows, count: null, error: null },
          { data: [rows[0]], count: null, error: null },
        ];

        const { events } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events.map((e) => e.id)).toEqual(['1']);
        expect(s.eventsBuilders).toHaveLength(4);
      });

      // Cutting at MAP_EVENT_LIMIT before the circle would drop matches the
      // list still counts, and the header would blame the gap on missing
      // coordinates.
      it('pages the map through every candidate when a client filter applies', async () => {
        const s = setup();
        s.results.eventsQueue = [
          { data: Array.from({ length: 1000 }, (_, i) => at(i + 1, 0, 0)), count: null, error: null },
          { data: [at(1001, 0, 0), at(1002, 0.007, 0.011)], count: null, error: null },
        ];

        const { events, total } = await fetchMapEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events).toHaveLength(1001);
        expect(total).toBe(1001);
        expect(s.eventsBuilders[0].range).toHaveBeenCalledWith(0, 999);
        expect(s.eventsBuilders[1].range).toHaveBeenCalledWith(1000, 1999);
        expect(s.eventsBuilders[0].limit).not.toHaveBeenCalled();
      });

      // Rows sharing a date and a start time could otherwise trade places
      // between two pages of the scan and be counted twice, or not at all.
      it('breaks ordering ties by id so the scan pages are stable', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: [], count: null, error: null }];

        await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(s.eventsBuilders[0].order).toHaveBeenLastCalledWith('id', { ascending: true });
      });

      it('skips the page request when the page is empty', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: [at(1, 0.007, 0.011)], count: null, error: null }];

        const { events, total } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events).toEqual([]);
        expect(total).toBe(0);
        expect(s.eventsBuilders).toHaveLength(1);
      });

      it('orders by distance in the scan, nearest first', async () => {
        const s = setup();
        // The database's (date) order: far, near, middle.
        const rows = [at(1, 0.006, 0), at(2, 0.001, 0), at(3, 0.003, 0)];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: rows, count: null, error: null },
        ];

        const { events } = await fetchEvents('wroclaw', makeFilters({ near: NEAR, sort: 'distance' }));

        expect(events.map((e) => e.id)).toEqual(['2', '3', '1']);
      });

      it('orders by distance farthest first for dir: desc, ties keeping date order', async () => {
        const s = setup();
        const rows = [at(1, 0.001, 0), at(2, 0.006, 0), at(3, 0.001, 0)];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: rows, count: null, error: null },
        ];

        const { events } = await fetchEvents(
          'wroclaw',
          makeFilters({ near: NEAR, sort: 'distance', dir: 'desc' })
        );

        expect(events.map((e) => e.id)).toEqual(['2', '1', '3']);
      });

      it('asks the database for ascending date order under a distance sort, either direction', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: [], count: null, error: null }];

        await fetchEvents('wroclaw', makeFilters({ near: NEAR, sort: 'distance', dir: 'desc' }));

        const scan = s.eventsBuilders[0];
        expect(scan.order).toHaveBeenNthCalledWith(1, 'date', { ascending: true });
        expect(scan.order).toHaveBeenNthCalledWith(2, 'time_start', { ascending: true });
      });

      it('applies free-only and the circle together', async () => {
        const s = setup();
        const rows = [
          makeRow({ id: 1, lat: 51.11, lng: 17.032, is_free: true, price: null, price_label: '' }),
          makeRow({ id: 2, lat: 51.11, lng: 17.032, is_free: false, price: 50, price_label: '50 zł' }),
          makeRow({ id: 3, lat: 51.13, lng: 17.032, is_free: true, price: null, price_label: '' }),
        ];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: rows, count: null, error: null },
        ];

        const { events, total } = await fetchEvents(
          'wroclaw',
          makeFilters({ near: NEAR, freeOnly: true })
        );

        expect(events.map((e) => e.id)).toEqual(['1']);
        expect(total).toBe(1);
      });

      it('throws ServerError when the scan fails', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: null, count: null, error: { message: 'boom' } }];

        await expect(fetchEvents('wroclaw', makeFilters({ near: NEAR }))).rejects.toBeInstanceOf(
          ServerError
        );
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

  describe('fetchOfferedSeasons', () => {
    const NOW = new Date(2026, 9, 28, 12, 0, 0);
    const row = (overrides: Record<string, unknown> = {}) => ({
      slug: 'halloween',
      name: 'Halloween',
      emoji: '🎃',
      description: 'Bale przebierańców.',
      date_from: '2026-10-15',
      date_to: '2026-11-02',
      show_from: '2026-10-10',
      sort: 10,
      ...overrides,
    });

    it('reads the active seasons of the city and counts each one from today on', async () => {
      const s = setup();
      s.results.seasons = { data: [row()], count: null, error: null };
      s.results.events = { data: null, count: 63, error: null };

      const seasons = await fetchOfferedSeasons('wroclaw', NOW);

      expect(getSupabaseForCityMock).toHaveBeenCalledWith('wroclaw');
      expect(s.seasonsBuilder.eq).toHaveBeenCalledWith('active', true);
      expect(s.eventsBuilder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(s.eventsBuilder.contains).toHaveBeenCalledWith('seasons', ['halloween']);
      expect(s.eventsBuilder.gte).toHaveBeenCalledWith('date', '2026-10-28');
      expect(s.eventsBuilder.lte).toHaveBeenCalledWith('date', '2027-01-28');
      expect(seasons).toEqual([
        {
          slug: 'halloween',
          name: 'Halloween',
          emoji: '🎃',
          description: 'Bale przebierańców.',
          dateFrom: '2026-10-15',
          dateTo: '2026-11-02',
          showFrom: '2026-10-10',
          sort: 10,
          count: 63,
          upcoming: false,
        },
      ]);
    });

    it('skips seasons outside their show window without counting them', async () => {
      const s = setup();
      s.results.seasons = {
        data: [row({ slug: 'swieta', date_from: '2026-11-15', date_to: '2026-12-26', show_from: '2026-11-10' })],
        count: null,
        error: null,
      };

      await expect(fetchOfferedSeasons('wroclaw', NOW)).resolves.toEqual([]);
      expect(s.eventsBuilders).toHaveLength(0);
    });

    it('drops a season with no events left — a tile promising nothing is worse than none', async () => {
      const s = setup();
      s.results.seasons = { data: [row()], count: null, error: null };
      s.results.events = { data: null, count: 0, error: null };

      await expect(fetchOfferedSeasons('wroclaw', NOW)).resolves.toEqual([]);
    });

    it('marks an announced season as upcoming, and starts one with no show_from on its first day', async () => {
      const s = setup();
      s.results.seasons = {
        data: [
          row({ date_from: '2026-11-01', show_from: '2026-10-20' }),
          row({ slug: 'jesien', show_from: null, date_from: '2026-10-29', date_to: '2026-11-30' }),
        ],
        count: null,
        error: null,
      };
      s.results.events = { data: null, count: 5, error: null };

      const seasons = await fetchOfferedSeasons('wroclaw', NOW);

      expect(seasons.map((season) => [season.slug, season.upcoming])).toEqual([['halloween', true]]);
    });

    it('throws ServerError when the table cannot be read', async () => {
      const s = setup();
      s.results.seasons = { data: null, count: null, error: { message: 'relation does not exist' } };

      await expect(fetchOfferedSeasons('wroclaw', NOW)).rejects.toBeInstanceOf(ServerError);
    });
  });
});

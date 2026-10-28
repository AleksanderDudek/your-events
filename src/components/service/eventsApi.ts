import { Event, DbCategory } from '@/types/event.types';
import { EventFilters } from '@/types/filter.types';
import { NotFoundError, ServerError } from '@/lib/utils';
import { getSupabaseForCity } from '@/lib/supabase';
import { expandWeekdayDates } from '@/lib/weekdays';
import { CityId, getCity, CATEGORIES_CITY_ID } from '@/config/cities';
import { shortId } from '@/lib/slug';
import { boundingBox, distanceMeters } from '@/lib/geo';
import { defaultDateWindow } from '@/lib/dateWindows';
import { isSeasonUpcoming, parseSeasonSlug, seasonsInWindow } from '@/lib/seasons';
import { OfferedSeason, Season } from '@/types/season.types';

interface SupabaseEventRow {
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

// The columns the client-side filters read (see matchesClientFilters) — all a
// scan has to fetch.
type ClientFilterRow = Pick<SupabaseEventRow, 'id' | 'lat' | 'lng' | 'is_free' | 'price' | 'price_label'>;
const CLIENT_FILTER_COLUMNS = 'id,lat,lng,is_free,price,price_label';

// A "descriptive" label carries meaningful words beyond a bare number + currency
// (e.g. "Karnet od 189 zł"), so it should be shown verbatim rather than reduced
// to a number. "40 zł" / "35 PLN" strip down to nothing → not descriptive.
function isDescriptivePriceLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  if (/https?:\/\//i.test(label)) return false;
  const residual = label
    .toLowerCase()
    .replace(/z[łl]|pln|gr\b/g, '')  // currency tokens
    .replace(/[0-9]/g, '')
    .replace(/[^a-ząćęłńóśźż]/g, ''); // keep only letters
  return residual.length > 0;
}

function parsePriceAmount(row: Pick<SupabaseEventRow, 'is_free' | 'price' | 'price_label'>): number | null {
  if (row.is_free) return 0;
  // Reject prices parsed from URL fragments (e.g. price=196331 for a
  // kupbilecik ticket id). isRealisticPrice in the UI also guards.
  if (row.price_label && /https?:\/\//i.test(row.price_label)) return null;
  if (row.price !== null) return row.price;
  if (row.price_label) {
    const lower = row.price_label.toLowerCase();
    if (lower.includes('darmowe') || lower.includes('bezpłat') || lower.includes('gratis') || lower.trim() === '0') return 0;
    const match = /\d+/.exec(row.price_label);
    if (match) return Number.parseInt(match[0], 10);
  }
  return null;
}

function parseSources(raw: string | null | undefined, fallback: string): string[] {
  if (!raw) return fallback ? [fallback] : [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
      return cleaned.length > 0 ? cleaned : fallback ? [fallback] : [];
    }
  } catch {
    // sources column is sometimes a bare string, sometimes JSON-encoded array.
  }
  return fallback ? [fallback] : [];
}

// Scrapers occasionally write a whole DOM fragment into a time column (one
// Zdrofit row carries "50 min19wolnychShape Funkcjonalny..." as time_start).
// The Event contract promises HH:MM, and every consumer trusts it — the label
// renderer, the JSON-LD startDate and the calendar builder, which turns an
// unparseable time into `new Date(NaN)` and throws mid-prerender, failing the
// whole static export. Anything that is not a real clock time becomes '', the
// same value a genuinely time-less event carries, so consumers already handle it.
function normalizeTime(raw: string | null | undefined): string {
  if (!raw) return '';
  // Accept H:MM and HH:MM:SS as well; seconds are dropped.
  const match = /^\s*(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*$/.exec(raw);
  if (!match) return '';
  const hours = Number(match[1]);
  if (hours > 23) return '';
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

function mapRow(row: SupabaseEventRow, cityName: string): Event {
  return {
    id: String(row.id),
    eventKey: row.event_key,
    name: row.name,
    description: row.description,
    categoryMain: row.category_main,
    categorySub: row.category_sub ?? '',
    date: row.date,
    startTime: normalizeTime(row.time_start),
    endTime: normalizeTime(row.time_end),
    durationMin: row.duration_min,
    location: {
      name: row.venue,
      city: cityName,
      lat: row.lat,
      lng: row.lng,
    },
    price: {
      amount: parsePriceAmount(row),
      currency: 'PLN',
      label: row.price_label ?? '',
      // Show the label verbatim only for label-only pricing (no numeric price
      // column) with a descriptive label – e.g. Zdrofit "Karnet od 189 zł".
      // Events with a real numeric price (e.g. Mizukon 42) keep "42 zł".
      showLabel: row.price === null && !row.is_free && isDescriptivePriceLabel(row.price_label),
    },
    url: row.url ?? '',
    imageUrl: row.image_url ?? '',
    sources: parseSources(row.sources, row.source),
    updatedAt: row.updated_at ?? null,
  };
}

export interface ResolvedCategoryFilter {
  topLevelMains: string[];
  subPairs: Array<{ main: string; sub: string }>;
}

const EMPTY_CATEGORY_FILTER: ResolvedCategoryFilter = { topLevelMains: [], subPairs: [] };

// PostgREST needs values inside an `or=` group double-quoted once they contain
// reserved chars (comma, dot, parens, spaces). Inside those quotes `\` is the
// escape char, so it has to be doubled too — free-text search reaches here.
function quoteForOr(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`;
}

// Ceiling on rows the map view pulls in one go. PostgREST caps a response at
// 1000 rows anyway; naming it here makes the truncation visible to callers
// instead of it looking like the city simply has no more events.
export const MAP_EVENT_LIMIT = 1000;

// The column list is a type parameter, not a plain string: supabase-js parses
// the literal to type the rows, and a widened `string` would type them as a
// parse error instead.
interface QueryShape<Columns extends string> {
  /** PostgREST `select` list. */
  columns?: Columns;
  /** Ask for an exact count alongside the rows. */
  withCount?: boolean;
}

/**
 * The filter clauses shared by every events query, so the list and the map can
 * never disagree about what "matching" means. Paging and map-specific narrowing
 * are left to the caller — that is the only thing the two differ on.
 */
function buildFilteredQuery<Columns extends string = '*'>(
  supabase: ReturnType<typeof getSupabaseForCity>,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter,
  { columns = '*' as Columns, withCount = true }: QueryShape<Columns> = {}
) {
  let query = supabase.from('events').select(columns, withCount ? { count: 'exact' } : undefined);

  // People search either for what ("jazz") or for where ("Filharmonia"), so one
  // box matches both columns. This `or=` group ANDs with the category one below.
  if (filters.search) {
    const term = quoteForOr(`%${filters.search}%`);
    query = query.or(`name.ilike.${term},venue.ilike.${term}`);
  }

  const { topLevelMains, subPairs } = categoryFilter;
  const hasMains = topLevelMains.length > 0;
  const hasSubs = subPairs.length > 0;
  if (hasMains && !hasSubs) {
    query = query.in('category_main', topLevelMains);
  } else if (hasSubs) {
    const orParts: string[] = [];
    if (hasMains) {
      orParts.push(`category_main.in.(${topLevelMains.map(quoteForOr).join(',')})`);
    }
    for (const { main, sub } of subPairs) {
      orParts.push(`and(category_main.eq.${quoteForOr(main)},category_sub.eq.${quoteForOr(sub)})`);
    }
    query = query.or(orParts.join(','));
  }

  // `seasons` is a text[] tagged by the pipeline; `cs` is "contains". The slug
  // was validated on the way in (parseSeasonSlug), so it cannot reshape the
  // array literal.
  if (filters.season) query = query.contains('seasons', [filters.season]);

  if (filters.dateSingle) query = query.eq('date', filters.dateSingle);
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);

  // Day-of-week has no column to compare against, so the selection is expanded
  // into the dates it covers and sent as a set membership test. A `null` back
  // means the selection excludes nothing and the query must stay as it is; an
  // empty list means it excludes everything, and `in.()` is exactly that.
  const weekdayDates = expandWeekdayDates(
    filters.weekdays,
    {
      from: filters.dateSingle ?? filters.dateFrom,
      to: filters.dateSingle ?? filters.dateTo,
    },
    new Date()
  );
  if (weekdayDates !== null) query = query.in('date', weekdayDates);

  if (filters.dateMode && filters.hourFrom) query = query.gte('time_start', filters.hourFrom);
  if (filters.dateMode && filters.hourTo) query = query.lte('time_start', filters.hourTo);

  // Proximity, first pass: the box around the circle, as four comparisons on
  // plain columns — no extension, no index, and it works against every schema
  // as it stands. The exact circle is the browser's job (matchesClientFilters);
  // the box only has to contain it. Rows with no coordinates fail the
  // comparisons and drop out here.
  if (filters.near) {
    const box = boundingBox(filters.near, filters.near.radius);
    query = query
      .gte('lat', box.south)
      .lte('lat', box.north)
      .gte('lng', box.west)
      .lte('lng', box.east);
  }

  return applyOrder(query, filters);
}

// The narrowest shape `buildFilteredQuery`'s ordering tail needs — enough to
// satisfy eslint's ban on `any` without pulling in the full PostgREST builder
// generics.
interface PostgrestOrderable {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): PostgrestOrderable;
}

// Ordering runs in Postgres, not in the browser: the list and the map share
// this builder precisely so the two can never disagree about what "matching"
// or "first" means.
//
// `date` is both the default sort and the fallback here, so an unrecognised
// key can never leave a query unordered — which would hand PostgREST licence
// to return rows in any order it likes, and page 2 could repeat page 1.
function applyOrder<T>(query: T, filters: EventFilters): T {
  const ascending = filters.dir !== 'desc';
  const builder = query as PostgrestOrderable;
  switch (filters.sort) {
    case 'name':
      return builder.order('name', { ascending }) as T;
    case 'venue':
      return builder.order('venue', { ascending }) as T;
    case 'price':
      // Nulls last in BOTH directions. An unknown price is neither the
      // cheapest nor the most expensive, and it must never head the list.
      return builder.order('price', { ascending, nullsFirst: false }) as T;
    case 'distance':
      // The database cannot measure distance; the scan sorts by it afterwards
      // (scanMatchingIds). What it can do is hand over the ties — one venue,
      // many events — already in the order they should keep: soonest first,
      // whichever way the distance runs.
      return builder
        .order('date', { ascending: true })
        .order('time_start', { ascending: true }) as T;
    case 'date':
    default:
      return builder
        .order('date', { ascending })
        .order('time_start', { ascending }) as T;
  }
}

// The filters with no column to compare against: free entry is derived from
// three price columns, and a circle is not a range. Both run on raw rows, so a
// scan can apply them to its six columns without building whole events.
function hasClientFilters(filters: EventFilters): boolean {
  return filters.freeOnly || filters.near !== null;
}

function matchesClientFilters(row: ClientFilterRow, filters: EventFilters): boolean {
  if (filters.freeOnly) {
    const amount = parsePriceAmount(row);
    if (amount !== 0 && amount !== null) return false;
  }
  if (filters.near) {
    if (row.lat === null || row.lng === null) return false;
    if (distanceMeters(filters.near, { lat: row.lat, lng: row.lng }) > filters.near.radius) {
      return false;
    }
  }
  return true;
}

// PostgREST ends a response at 1000 rows whatever was asked for, so a scan
// requests exactly that much per page and keeps going while pages come back
// full. The page cap is a runaway guard, not a product limit: 20 pages is 20k
// matching events in one city.
const SCAN_PAGE_SIZE = 1000;
const SCAN_MAX_PAGES = 20;
// The map reads whole rows, ~2.4 KB each, so its runaway guard is tighter.
const MAP_SCAN_MAX_PAGES = 5;

/**
 * The ids of every event passing the client filters, in list order.
 *
 * Only the columns those filters read are fetched — ~95 bytes a row against
 * ~2.4 KB for a whole one (measured on Wrocław's 5 km box: 7 KB gzipped
 * against 505 KB) — so the total and the page boundaries are found without
 * downloading every match in full.
 */
async function scanMatchingIds(
  supabase: ReturnType<typeof getSupabaseForCity>,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter
): Promise<number[]> {
  const matches: ClientFilterRow[] = [];
  for (let page = 0; ; page += 1) {
    // Reaching the cap with pages still full would mean a wrong total and
    // unreachable pages — fail loudly rather than serve them.
    if (page === SCAN_MAX_PAGES) {
      throw new ServerError(`Scan exceeded ${SCAN_MAX_PAGES * SCAN_PAGE_SIZE} rows`);
    }
    const from = page * SCAN_PAGE_SIZE;
    // `id` breaks ties, so rows sharing a date and time cannot trade places
    // between two pages of the scan and be counted twice or not at all.
    const { data, error } = await buildFilteredQuery(supabase, filters, categoryFilter, {
      columns: CLIENT_FILTER_COLUMNS,
      withCount: false,
    })
      .order('id', { ascending: true })
      .range(from, from + SCAN_PAGE_SIZE - 1);
    if (error) throw new ServerError(error.message);

    const batch = (data as ClientFilterRow[] | null) ?? [];
    for (const row of batch) {
      if (matchesClientFilters(row, filters)) matches.push(row);
    }
    if (batch.length < SCAN_PAGE_SIZE) break;
  }

  const near = filters.near;
  if (filters.sort === 'distance' && near) {
    const sign = filters.dir === 'desc' ? -1 : 1;
    // Every match has coordinates: the circle let none through without them.
    const distance = new Map(
      matches.map((row) => [
        row.id,
        distanceMeters(near, { lat: row.lat as number, lng: row.lng as number }),
      ])
    );
    // Array#sort is stable, so equal distances keep the database's date order.
    matches.sort((a, b) => sign * ((distance.get(a.id) ?? 0) - (distance.get(b.id) ?? 0)));
  }
  return matches.map((row) => row.id);
}

/** Whole rows for `ids`, in the order given — `in` answers in whatever order it likes. */
async function fetchRowsInOrder(
  supabase: ReturnType<typeof getSupabaseForCity>,
  ids: number[],
  cityName: string
): Promise<Event[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('events').select('*').in('id', ids);
  if (error) throw new ServerError(error.message);
  const byId = new Map(((data as SupabaseEventRow[] | null) ?? []).map((row) => [row.id, row]));
  // An id whose row vanished between the scan and now is skipped; the caller
  // decides whether a short page is worth another look.
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [mapRow(row, cityName)] : [];
  });
}

/** One scan, then whole rows for the ids that fall on the page. */
async function fetchScannedPage(
  supabase: ReturnType<typeof getSupabaseForCity>,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter,
  cityName: string,
  from: number,
  to: number
): Promise<{ events: Event[]; total: number; complete: boolean }> {
  const ids = await scanMatchingIds(supabase, filters, categoryFilter);
  const pageIds = ids.slice(from, to + 1);
  const events = await fetchRowsInOrder(supabase, pageIds, cityName);
  return { events, total: ids.length, complete: events.length === pageIds.length };
}

export async function fetchEvents(
  cityId: CityId | string,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter = EMPTY_CATEGORY_FILTER
): Promise<{ events: Event[]; total: number }> {
  const city = getCity(cityId);
  const supabase = getSupabaseForCity(city.id);
  const cityName = city.displayName.pl;
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  // A filter the database cannot evaluate also defeats its count and its
  // paging, so such a list is found in two steps: every matching id (the
  // scan), then whole rows for this page only.
  if (hasClientFilters(filters)) {
    const page = await fetchScannedPage(supabase, filters, categoryFilter, cityName, from, to);
    if (page.complete) return { events: page.events, total: page.total };
    // Rows the scan found are gone by the time the page is read. Ids churn —
    // the scraper rewrites rows under new ones — so a rewrite landing between
    // the two requests can empty a page the count still calls full. One fresh
    // read settles it; if that is short too, a row really was deleted.
    const retry = await fetchScannedPage(supabase, filters, categoryFilter, cityName, from, to);
    return { events: retry.events, total: retry.total };
  }

  const { data, count, error } = await buildFilteredQuery(supabase, filters, categoryFilter).range(
    from,
    to
  );
  if (error) throw new ServerError(error.message);

  const events = ((data as SupabaseEventRow[] | null) ?? []).map((row) => mapRow(row, cityName));
  return { events, total: count ?? 0 };
}

/**
 * Every matching event that can actually be placed on a map, ignoring paging.
 *
 * The map used to render whatever page the list was on, so a city with 593
 * matches showed at most `pageSize` pins — a dozen dots standing in for the
 * whole city. Paging is a reading aid for a list; a map is a single view of the
 * whole result, and cutting it to 15 rows made it lie.
 *
 * Rows without coordinates are excluded in the query rather than dropped after
 * arriving: they can never become a pin, and leaving them in would spend the
 * row budget on events the map cannot show. `total` is the count of mappable
 * matches, so callers can say how many of the results made it onto the map.
 */
export async function fetchMapEvents(
  cityId: CityId | string,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter = EMPTY_CATEGORY_FILTER
): Promise<{ events: Event[]; total: number }> {
  const city = getCity(cityId);
  const supabase = getSupabaseForCity(city.id);
  const cityName = city.displayName.pl;

  // The filters with no column behind them (free entry, the circle) run here,
  // as in fetchEvents. Cutting the rows at MAP_EVENT_LIMIT before them would
  // drop matches the list still counts — and the header would blame the gap
  // on missing coordinates — so this read pages through every candidate, as
  // the list's scan does. For a circle the box keeps that to a page or two.
  if (hasClientFilters(filters)) {
    const rows: SupabaseEventRow[] = [];
    for (let page = 0; ; page += 1) {
      if (page === MAP_SCAN_MAX_PAGES) {
        throw new ServerError(`Map read exceeded ${MAP_SCAN_MAX_PAGES * SCAN_PAGE_SIZE} rows`);
      }
      const from = page * SCAN_PAGE_SIZE;
      const { data, error } = await buildFilteredQuery(supabase, filters, categoryFilter, {
        withCount: false,
      })
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + SCAN_PAGE_SIZE - 1);
      if (error) throw new ServerError(error.message);

      const batch = (data as SupabaseEventRow[] | null) ?? [];
      rows.push(...batch.filter((row) => matchesClientFilters(row, filters)));
      if (batch.length < SCAN_PAGE_SIZE) break;
    }
    const events = rows.map((row) => mapRow(row, cityName));
    return { events, total: events.length };
  }

  const { data, count, error } = await buildFilteredQuery(supabase, filters, categoryFilter)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(MAP_EVENT_LIMIT);
  if (error) throw new ServerError(error.message);

  const events = ((data as SupabaseEventRow[] | null) ?? []).map((row) => mapRow(row, cityName));
  return { events, total: count ?? events.length };
}

export async function fetchEvent(cityId: CityId | string, id: string): Promise<Event> {
  const city = getCity(cityId);
  const supabase = getSupabaseForCity(city.id);
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', Number(id))
    .single();

  if (error?.code === 'PGRST116') throw new NotFoundError();
  if (error) throw new ServerError(error.message);

  return mapRow(data as SupabaseEventRow, city.displayName.pl);
}

export async function fetchCategories(): Promise<DbCategory[]> {
  const supabase = getSupabaseForCity(CATEGORIES_CITY_ID);
  const { data, error } = await supabase
    .from('categories')
    .select('slug, parent_slug, display_name, display_plural, icon, color, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new ServerError(error.message);
  return (data ?? []) as DbCategory[];
}

interface SupabaseSeasonRow {
  slug: string;
  name: string;
  emoji: string | null;
  description: string | null;
  date_from: string;
  date_to: string;
  show_from: string | null;
  sort: number | null;
}

function mapSeason(row: SupabaseSeasonRow): Season {
  return {
    slug: row.slug,
    name: row.name,
    emoji: row.emoji ?? '',
    description: row.description ?? '',
    dateFrom: row.date_from,
    dateTo: row.date_to,
    // No announcement date means the section appears when the season starts.
    showFrom: row.show_from ?? row.date_from,
    sort: row.sort ?? 0,
  };
}

/**
 * The seasonal sections worth offering in this city today: switched on, inside
 * their show window, and with at least one event left in the window the list
 * shows by default. A season whose last event has passed (Halloween on 1 Nov)
 * would otherwise promise a list that comes up empty.
 *
 * Read from the city's own project — its events carry the tags — so a season
 * can be live in one city and not another.
 */
export async function fetchOfferedSeasons(
  cityId: CityId | string,
  now: Date
): Promise<OfferedSeason[]> {
  const city = getCity(cityId);
  const supabase = getSupabaseForCity(city.id);
  const { data, error } = await supabase
    .from('seasons')
    .select('slug, name, emoji, description, date_from, date_to, show_from, sort')
    .eq('active', true)
    .order('sort');
  if (error) throw new ServerError(error.message);

  // Only slugs the URL can carry back are offered: one the parser would drop
  // (`boze_narodzenie`, `Walentynki`) would open an unfiltered list from its
  // tile and leave its toggle unable to show as pressed.
  const rows = ((data as SupabaseSeasonRow[] | null) ?? []).filter(
    (row) => parseSeasonSlug(row.slug) !== null
  );
  const candidates = seasonsInWindow(rows.map(mapSeason), now);
  if (candidates.length === 0) return [];

  const { dateFrom, dateTo } = defaultDateWindow(now);
  const counted = await Promise.all(
    candidates.map(async (season) => {
      const { count, error: countError } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .contains('seasons', [season.slug])
        .gte('date', dateFrom)
        .lte('date', dateTo);
      if (countError) throw new ServerError(countError.message);
      return { ...season, count: count ?? 0, upcoming: isSeasonUpcoming(season, now) };
    })
  );
  return counted.filter((season) => season.count > 0);
}

// Build-time cache: one fetch-all per city per build process. Shared by
// generateStaticParams and every static detail/hub page so we never refetch.
const cityEventsCache = new Map<string, Promise<Event[]>>();

// PostgREST caps a response at 1000 rows, so the whole-city read is paged.
// The page cap is a runaway guard, not a product limit — 50 pages is 50k events
// in one city, far past anything the scraper produces.
const CITY_EVENTS_PAGE_SIZE = 1000;
const CITY_EVENTS_MAX_PAGES = 50;

export function getCityEvents(cityId: CityId | string): Promise<Event[]> {
  const city = getCity(cityId);
  const cached = cityEventsCache.get(city.id);
  if (cached) return cached;
  const promise = (async () => {
    const supabase = getSupabaseForCity(city.id);

    // Paged rather than relying on PostgREST's 1000-row default. Everything
    // built from this list — the static routes, the sitemap, the related-events
    // rail — degrades silently and without an error when the city outgrows one
    // page: pages simply stop being generated for the events past the cut.
    const rows: SupabaseEventRow[] = [];
    for (let page = 0; page < CITY_EVENTS_MAX_PAGES; page += 1) {
      const from = page * CITY_EVENTS_PAGE_SIZE;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date')
        .order('time_start')
        .range(from, from + CITY_EVENTS_PAGE_SIZE - 1);
      if (error) throw new ServerError(error.message);

      const batch = (data as SupabaseEventRow[]) ?? [];
      rows.push(...batch);
      if (batch.length < CITY_EVENTS_PAGE_SIZE) break;
    }

    const cityName = city.displayName.pl;
    const mapped = rows.map((row) => mapRow(row, cityName));

    // Permalinks derive from shortId(event_key); a collision would make two
    // events resolve to the same page. Astronomically unlikely at this scale,
    // but fail the build loudly (deploy notifies on failure) rather than serve
    // wrong content silently.
    if (new Set(mapped.map((e) => shortId(e.eventKey))).size !== mapped.length) {
      throw new ServerError(`Duplicate permalink shortId within city "${city.id}"`);
    }

    return mapped;
  })();
  cityEventsCache.set(city.id, promise);
  return promise;
}

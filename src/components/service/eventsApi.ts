import { Event, DbCategory } from '@/types/event.types';
import { EventFilters } from '@/types/filter.types';
import { NotFoundError, ServerError } from '@/lib/utils';
import { getSupabaseForCity } from '@/lib/supabase';
import { CityId, getCity, CATEGORIES_CITY_ID } from '@/config/cities';
import { shortId } from '@/lib/slug';

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

function parsePriceAmount(row: SupabaseEventRow): number | null {
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

function mapRow(row: SupabaseEventRow, cityName: string): Event {
  return {
    id: String(row.id),
    eventKey: row.event_key,
    name: row.name,
    description: row.description,
    categoryMain: row.category_main,
    categorySub: row.category_sub ?? '',
    date: row.date,
    startTime: row.time_start,
    endTime: row.time_end,
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

/**
 * The filter clauses shared by every events query, so the list and the map can
 * never disagree about what "matching" means. Paging and map-specific narrowing
 * are left to the caller — that is the only thing the two differ on.
 */
function buildFilteredQuery(
  supabase: ReturnType<typeof getSupabaseForCity>,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter
) {
  let query = supabase.from('events').select('*', { count: 'exact' });

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

  if (filters.dateSingle) query = query.eq('date', filters.dateSingle);
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.dateMode && filters.hourFrom) query = query.gte('time_start', filters.hourFrom);
  if (filters.dateMode && filters.hourTo) query = query.lte('time_start', filters.hourTo);

  return query.order('date').order('time_start');
}

export async function fetchEvents(
  cityId: CityId | string,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter = EMPTY_CATEGORY_FILTER
): Promise<{ events: Event[]; total: number }> {
  const city = getCity(cityId);
  const supabase = getSupabaseForCity(city.id);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const needsClientFilter = filters.freeOnly;

  let query = buildFilteredQuery(supabase, filters, categoryFilter);
  if (!needsClientFilter) query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new ServerError(error.message);

  const cityName = city.displayName.pl;
  const mapped = (data as SupabaseEventRow[] ?? []).map((row) => mapRow(row, cityName));

  if (!needsClientFilter) {
    return { events: mapped, total: count ?? 0 };
  }

  const filtered = applyClientFilters(mapped, filters);
  return { events: filtered.slice(from, to + 1), total: filtered.length };
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

  const { data, count, error } = await buildFilteredQuery(supabase, filters, categoryFilter)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(MAP_EVENT_LIMIT);
  if (error) throw new ServerError(error.message);

  const cityName = city.displayName.pl;
  const mapped = (data as SupabaseEventRow[] ?? []).map((row) => mapRow(row, cityName));

  // freeOnly has no column to filter on, so it is applied here — as in
  // fetchEvents — which means the total has to be recomputed from the result.
  if (filters.freeOnly) {
    const filtered = applyClientFilters(mapped, filters);
    return { events: filtered, total: filtered.length };
  }

  return { events: mapped, total: count ?? mapped.length };
}

function applyClientFilters(events: Event[], filters: EventFilters): Event[] {
  if (filters.freeOnly) {
    return events.filter((e) => e.price.amount === 0 || e.price.amount === null);
  }
  return events;
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

import { Event, DbCategory } from '@/types/event.types';
import { EventFilters } from '@/types/filter.types';
import { NotFoundError, ServerError } from '@/lib/utils';
import { getSupabaseForCity } from '@/lib/supabase';
import { CityId, getCity } from '@/config/cities';

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

function quoteForOr(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
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

  let query = supabase.from('events').select('*', { count: 'exact' });

  if (filters.search) query = query.ilike('name', `%${filters.search}%`);

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

  query = query.order('date').order('time_start');
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

export async function fetchCategories(cityId: CityId | string): Promise<DbCategory[]> {
  const supabase = getSupabaseForCity(cityId);
  const { data, error } = await supabase
    .from('categories')
    .select('slug, parent_slug, display_name, display_plural, icon, color, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new ServerError(error.message);
  return (data ?? []) as DbCategory[];
}

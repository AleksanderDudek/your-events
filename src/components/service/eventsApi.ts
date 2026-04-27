import { Event, EventCategory, CategoryItem, SourceItem, EventStatus } from '@/types/event.types';
import { EventFilters } from '@/types/filter.types';
import { NotFoundError, ServerError } from '@/lib/utils';
import { CATEGORY_LABELS, SOURCE_TYPE_LABELS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { mapCategories } from '@/lib/categoryMapping';

interface SupabaseEventRow {
  id: number;
  event_key: string;
  source: string;
  venue: string;
  date: string;
  day: string;
  time_start: string;
  time_end: string;
  duration_min: number | null;
  name: string;
  category: string;
  trainer: string;
  availability: string;
  room: string;
  price: string;
  description: string;
  url: string;
  status: string;
}

function parsePriceAmount(price: string): number | null {
  if (!price) return null;
  const lower = price.toLowerCase();
  if (lower.includes('bezpłat') || lower.includes('gratis') || lower.trim() === '0') return 0;
  const match = /\d+/.exec(price);
  return match ? Number.parseInt(match[0], 10) : null;
}

const VALID_STATUSES = new Set<EventStatus>(['active', 'cancelled', 'sold_out', 'few_spots']);

function mapStatus(status: string): EventStatus {
  return VALID_STATUSES.has(status as EventStatus) ? (status as EventStatus) : 'active';
}

function mapRow(row: SupabaseEventRow): Event {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    categories: mapCategories(row.source, row.category, row.name),
    tags: [],
    date: row.date,
    startTime: row.time_start,
    endTime: row.time_end,
    location: {
      name: row.venue,
      address: row.room,
      city: '',
    },
    price: {
      amount: parsePriceAmount(row.price),
      currency: 'PLN',
      description: row.price,
    },
    ageGroup: null,
    level: null,
    instructor: row.trainer || null,
    capacity: null,
    url: row.url,
    sourceName: row.source,
    sourceType: 'other',
    isRecurring: false,
    recurrenceRule: null,
    imageUrl: null,
    status: mapStatus(row.status),
  };
}

export async function fetchEvents(
  filters: EventFilters
): Promise<{ events: Event[]; total: number }> {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  // Category filter cannot be pushed to DB because the DB stores raw scraped strings
  // (e.g. "Kategoria:Muzyka | Jazz", "Od podstaw") while filters.categories holds
  // normalised EventCategory values.  Filtering happens client-side after mapRow().
  const needsClientFilter = filters.freeOnly || filters.categories.length > 0;

  let query = supabase.from('events').select('*', { count: 'exact' });

  if (filters.search) query = query.ilike('name', `%${filters.search}%`);
  if (filters.dateSingle) query = query.eq('date', filters.dateSingle);
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.hideUnavailable) query = query.neq('status', 'cancelled').neq('status', 'sold_out');
  if (filters.dateMode && filters.hourFrom) query = query.gte('time_start', filters.hourFrom);
  if (filters.dateMode && filters.hourTo) query = query.lte('time_start', filters.hourTo);

  query = query.order('date').order('time_start');
  if (!needsClientFilter) query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new ServerError(error.message);

  const mapped = (data as SupabaseEventRow[] ?? []).map(mapRow);

  if (!needsClientFilter) {
    return { events: mapped, total: count ?? 0 };
  }

  const filtered = applyClientFilters(mapped, filters);
  return { events: filtered.slice(from, to + 1), total: filtered.length };
}

function applyClientFilters(events: Event[], filters: EventFilters): Event[] {
  let result = events;
  if (filters.categories.length > 0) {
    const selected = new Set(filters.categories);
    result = result.filter((e) => e.categories.some((cat) => selected.has(cat)));
  }
  if (filters.freeOnly) {
    result = result.filter((e) => e.price.amount === 0 || e.price.amount === null);
  }
  return result;
}

export async function fetchEvent(id: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', Number(id))
    .single();

  if (error?.code === 'PGRST116') throw new NotFoundError();
  if (error) throw new ServerError(error.message);

  return mapRow(data as SupabaseEventRow);
}

export async function fetchCategories(): Promise<CategoryItem[]> {
  return Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
    id: id as EventCategory,
    label,
  }));
}

export async function fetchSources(): Promise<SourceItem[]> {
  return Object.entries(SOURCE_TYPE_LABELS).map(([id, label]) => ({
    id: id as keyof typeof SOURCE_TYPE_LABELS,
    label,
  }));
}

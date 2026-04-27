import { Event, EventCategory, EventStatus, CategoryItem, SourceItem } from '@/types/event.types';
import { EventFilters } from '@/types/filter.types';
import { NotFoundError, ServerError } from '@/lib/utils';
import { CATEGORY_LABELS, SOURCE_TYPE_LABELS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

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

function mapRow(row: SupabaseEventRow): Event {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    categories: row.category ? [row.category as EventCategory] : [],
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
    status: (row.status as EventStatus) || 'active',
  };
}

export async function fetchEvents(
  filters: EventFilters
): Promise<{ events: Event[]; total: number }> {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const needsClientFilter = filters.freeOnly;

  let query = supabase.from('events').select('*', { count: 'exact' });

  if (filters.search) query = query.ilike('name', `%${filters.search}%`);
  if (filters.dateSingle) query = query.eq('date', filters.dateSingle);
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.categories.length > 0) query = query.in('category', filters.categories);
  if (filters.hideUnavailable) query = query.neq('status', 'cancelled').neq('status', 'sold_out');
  if (filters.dateMode && filters.hourFrom) query = query.gte('time_start', filters.hourFrom);
  if (filters.dateMode && filters.hourTo) query = query.lte('time_start', filters.hourTo);

  query = query.order('date').order('time_start');
  if (!needsClientFilter) query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new ServerError(error.message);

  const mapped = (data as SupabaseEventRow[] ?? []).map(mapRow);

  if (needsClientFilter) {
    const filtered = mapped.filter(
      (e) => e.price.amount === 0 || e.price.amount === null
    );
    return {
      events: filtered.slice(from, to + 1),
      total: filtered.length,
    };
  }

  return { events: mapped, total: count ?? 0 };
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

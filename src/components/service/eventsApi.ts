import { Event, CategoryItem, SourceItem } from '@/types/event.types';
import { EventFilters } from '@/types/filter.types';
import { NotFoundError, NetworkError, ServerError } from '@/lib/utils';

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 404) {
    throw new NotFoundError();
  }
  if (response.status >= 500) {
    throw new ServerError();
  }
  if (!response.ok) {
    throw new NetworkError(`HTTP ${response.status}`);
  }
  return response.json();
}

function buildEventsQueryString(filters: EventFilters): string {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set('name_like', filters.search);
  }

  if (filters.dateSingle) {
    params.set('date', filters.dateSingle);
  }
  if (filters.dateFrom) {
    params.set('date_gte', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set('date_lte', filters.dateTo);
  }

  if (filters.ageGroup) {
    params.set('ageGroup', filters.ageGroup);
  }
  if (filters.level) {
    params.set('level', filters.level);
  }

  if (filters.freeOnly) {
    params.set('price.amount', '0');
  }

  params.set('_page', String(filters.page));
  params.set('_limit', String(filters.pageSize));
  params.set('_sort', 'date,startTime');
  params.set('_order', 'asc,asc');

  return params.toString();
}

function clientFilterEvent(event: Event, filters: EventFilters): boolean {
  if (filters.categories.length > 0) {
    const hasMatch = filters.categories.some((cat) => event.categories.includes(cat));
    if (!hasMatch) return false;
  }

  if (filters.sourceTypes.length > 0) {
    if (!filters.sourceTypes.includes(event.sourceType)) return false;
  }

  if (filters.hideUnavailable) {
    if (event.status === 'cancelled' || event.status === 'sold_out') return false;
  }

  if (filters.hourFrom && filters.dateMode) {
    if (event.startTime < filters.hourFrom) return false;
  }
  if (filters.hourTo && filters.dateMode) {
    if (event.startTime > filters.hourTo) return false;
  }

  if (filters.freeOnly) {
    if (event.price.amount !== 0 && event.price.amount !== null) return false;
  }

  return true;
}

export async function fetchEvents(
  filters: EventFilters
): Promise<{ events: Event[]; total: number }> {
  const baseUrl = getBaseUrl();
  const query = buildEventsQueryString(filters);
  const url = `${baseUrl}/events?${query}`;

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 60 } });
  } catch {
    throw new NetworkError('Nie udało się połączyć z serwerem');
  }

  const events = await handleResponse<Event[]>(response);
  const totalHeader = response.headers.get('X-Total-Count');
  const serverTotal = totalHeader ? parseInt(totalHeader, 10) : events.length;

  const filtered = events.filter((event) => clientFilterEvent(event, filters));

  return {
    events: filtered,
    total: serverTotal,
  };
}

export async function fetchEvent(id: string): Promise<Event> {
  const baseUrl = getBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/events/${id}`, { next: { revalidate: 60 } });
  } catch {
    throw new NetworkError('Nie udało się połączyć z serwerem');
  }
  return handleResponse<Event>(response);
}

export async function fetchCategories(): Promise<CategoryItem[]> {
  const baseUrl = getBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/categories`, { next: { revalidate: false } });
  } catch {
    throw new NetworkError('Nie udało się połączyć z serwerem');
  }
  return handleResponse<CategoryItem[]>(response);
}

export async function fetchSources(): Promise<SourceItem[]> {
  const baseUrl = getBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/sources`, { next: { revalidate: false } });
  } catch {
    throw new NetworkError('Nie udało się połączyć z serwerem');
  }
  return handleResponse<SourceItem[]>(response);
}

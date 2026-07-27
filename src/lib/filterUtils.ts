import { DateMode, EventFilters, PageSize, ViewMode } from '@/types/filter.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from './constants';
import { parseWeekdays, serializeWeekdays } from './weekdays';

const VALID_PAGE_SIZES = new Set([15, 30, 60]);
const VALID_VIEW_MODES = new Set(['grid', 'row', 'map']);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

function parseCategories(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter((c) => c.length > 0);
}

function parseDateMode(params: URLSearchParams): DateMode {
  const mode = params.get('dateMode');
  if (mode === 'single' || mode === 'range') return mode;
  // fallback: infer from values (e.g. URL shared without explicit dateMode)
  const single = params.get('dateSingle');
  const from = params.get('dateFrom');
  const to = params.get('dateTo');
  if (single && DATE_REGEX.test(single)) return 'single';
  if ((from && DATE_REGEX.test(from)) || (to && DATE_REGEX.test(to))) return 'range';
  return null;
}

function parseDate(value: string | null): string | null {
  if (!value || !DATE_REGEX.test(value)) return null;
  return value;
}

function parseTime(value: string | null): string | null {
  if (!value || !TIME_REGEX.test(value)) return null;
  return value;
}

function parseBoolean(value: string | null): boolean {
  return value === 'true';
}

function parsePage(value: string | null): number {
  const num = Number.parseInt(value ?? '', 10);
  return Number.isNaN(num) || num < 1 ? DEFAULT_PAGE : num;
}

function parsePageSize(value: string | null): PageSize {
  const num = Number.parseInt(value ?? '', 10);
  return VALID_PAGE_SIZES.has(num) ? (num as PageSize) : DEFAULT_PAGE_SIZE;
}

function parseViewMode(value: string | null): ViewMode {
  return VALID_VIEW_MODES.has(value ?? '') ? (value as ViewMode) : 'grid';
}

export function parseFiltersFromParams(
  params: Record<string, string | string[] | undefined> | URLSearchParams
): EventFilters {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const val = params[key];
    if (Array.isArray(val)) return val[0] ?? null;
    return val ?? null;
  };

  const searchParams = params instanceof URLSearchParams ? params : new URLSearchParams();
  if (!(params instanceof URLSearchParams)) {
    Object.entries(params).forEach(([k, v]) => {
      if (typeof v === 'string') searchParams.set(k, v);
      else if (Array.isArray(v)) v.forEach((val) => searchParams.append(k, val));
    });
  }

  const dateMode = parseDateMode(searchParams);

  return {
    search: get('search') ?? '',
    categories: parseCategories(get('categories')),
    dateMode,
    dateSingle: dateMode === 'single' ? parseDate(get('dateSingle')) : null,
    dateFrom: dateMode === 'range' ? parseDate(get('dateFrom')) : null,
    dateTo: dateMode === 'range' ? parseDate(get('dateTo')) : null,
    // Not gated on dateMode the way the hour range is: "only on Mondays" is a
    // complete filter by itself.
    weekdays: parseWeekdays(get('weekdays')),
    hourFrom: dateMode ? parseTime(get('hourFrom')) : null,
    hourTo: dateMode ? parseTime(get('hourTo')) : null,
    freeOnly: parseBoolean(get('freeOnly')),
    page: parsePage(get('page')),
    pageSize: parsePageSize(get('pageSize')),
    viewMode: parseViewMode(get('viewMode')),
  };
}

function setIfTruthy(params: URLSearchParams, key: string, value: string | null | undefined): void {
  if (value) params.set(key, value);
}

export function filtersToSearchParams(filters: Partial<EventFilters>): URLSearchParams {
  const params = new URLSearchParams();

  setIfTruthy(params, 'search', filters.search);
  if (filters.categories?.length) params.set('categories', filters.categories.join(','));
  setIfTruthy(params, 'dateMode', filters.dateMode);
  setIfTruthy(params, 'dateSingle', filters.dateSingle);
  setIfTruthy(params, 'dateFrom', filters.dateFrom);
  setIfTruthy(params, 'dateTo', filters.dateTo);
  if (filters.weekdays?.length) params.set('weekdays', serializeWeekdays(filters.weekdays));
  setIfTruthy(params, 'hourFrom', filters.hourFrom);
  setIfTruthy(params, 'hourTo', filters.hourTo);
  if (filters.freeOnly) params.set('freeOnly', 'true');
  if (filters.page && filters.page !== DEFAULT_PAGE) params.set('page', String(filters.page));
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(filters.pageSize));
  if (filters.viewMode && filters.viewMode !== 'grid') params.set('viewMode', filters.viewMode);

  return params;
}

export function countActiveFilters(filters: EventFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.categories.length) count++;
  if (filters.dateMode) count++;
  if (filters.weekdays.length) count++;
  if (filters.hourFrom || filters.hourTo) count++;
  if (filters.freeOnly) count++;
  return count;
}

export function getDefaultFilters(): EventFilters {
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
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
    viewMode: 'grid',
  };
}

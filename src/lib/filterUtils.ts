import { DateMode, EventFilters, NearFilter, PageSize, SortDir, SortKey, ViewMode } from '@/types/filter.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from './constants';
import { clampRadius, isValidLatLng, roundCoord } from './geo';
import { parseWeekdays, serializeWeekdays } from './weekdays';
import { parseSeasonSlug } from './seasons';

const VALID_PAGE_SIZES = new Set([15, 30, 60]);
const VALID_VIEW_MODES = new Set(['grid', 'row', 'map']);
const VALID_SORTS = new Set<SortKey>(['date', 'name', 'venue', 'price', 'distance']);
const DEFAULT_SORT: SortKey = 'date';
const DEFAULT_DIR: SortDir = 'asc';
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

function parseSort(value: string | null): SortKey {
  return VALID_SORTS.has(value as SortKey) ? (value as SortKey) : DEFAULT_SORT;
}

function parseDir(value: string | null): SortDir {
  return value === 'desc' ? 'desc' : DEFAULT_DIR;
}

// A point is written with at most 4 decimals (~11 m): plenty against a radius
// that starts at 500 m, and short enough to keep a shared link readable.
const NEAR_DECIMALS = 4;
export const MAX_NEAR_LABEL_LENGTH = 100;

/**
 * The proximity filter from its three parameters, or null when `near` is not a
 * usable point — radius and label then mean nothing and are dropped, the way an
 * hour range is without a date. A missing or junk radius falls back to the
 * default; an out-of-range one is clamped rather than rejected.
 */
export function parseNear(
  near: string | null,
  radius: string | null,
  label: string | null
): NearFilter | null {
  if (!near) return null;
  const parts = near.split(',');
  if (parts.length !== 2 || parts.some((part) => part.trim() === '')) return null;
  const [lat, lng] = parts.map(Number);
  if (!isValidLatLng(lat, lng)) return null;
  return {
    lat: roundCoord(lat, NEAR_DECIMALS),
    lng: roundCoord(lng, NEAR_DECIMALS),
    radius: clampRadius(radius ? Number(radius) : Number.NaN),
    label: label?.trim().slice(0, MAX_NEAR_LABEL_LENGTH) || null,
  };
}

function serializeNear(near: NearFilter): string {
  return `${roundCoord(near.lat, NEAR_DECIMALS)},${roundCoord(near.lng, NEAR_DECIMALS)}`;
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
  const near = parseNear(get('near'), get('radius'), get('nearLabel'));
  const sort = parseSort(get('sort'));

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
    near,
    season: parseSeasonSlug(get('season')),
    page: parsePage(get('page')),
    pageSize: parsePageSize(get('pageSize')),
    viewMode: parseViewMode(get('viewMode')),
    // Distance is measured from the point; with no point it reads as the default.
    sort: sort === 'distance' && !near ? DEFAULT_SORT : sort,
    dir: parseDir(get('dir')),
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
  if (filters.near) {
    params.set('near', serializeNear(filters.near));
    // Written even at its default: a shared link should say what it means, not
    // depend on what the default happens to be when it is opened.
    params.set('radius', String(clampRadius(filters.near.radius)));
    setIfTruthy(params, 'nearLabel', filters.near.label);
  }
  setIfTruthy(params, 'season', filters.season);
  if (filters.page && filters.page !== DEFAULT_PAGE) params.set('page', String(filters.page));
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(filters.pageSize));
  if (filters.viewMode && filters.viewMode !== 'grid') params.set('viewMode', filters.viewMode);
  // A distance ordering left behind by a removed point is only a stale parameter.
  const sort = filters.sort === 'distance' && !filters.near ? DEFAULT_SORT : filters.sort;
  if (sort && sort !== DEFAULT_SORT) params.set('sort', sort);
  if (filters.dir && filters.dir !== DEFAULT_DIR) params.set('dir', filters.dir);

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
  if (filters.near) count++;
  if (filters.season) count++;
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
    near: null,
    season: null,
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
    viewMode: 'grid',
    sort: DEFAULT_SORT,
    dir: DEFAULT_DIR,
  };
}

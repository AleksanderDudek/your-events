import { EventFilters, PageSize, ViewMode } from '@/types/filter.types';
import { FilterPreset, PresetDateWindow, PresetFilters } from '@/types/preset.types';
import { filtersToSearchParams } from './filterUtils';
import { getUpcomingWeekend } from './homeFilters';
import { DEFAULT_PAGE_SIZE } from './constants';

// Everything here is pure: the browser-storage side lives in
// components/service/usePresets. That split is what lets the rules below —
// which are the ones with teeth — be tested without a DOM.

export const MAX_PRESETS = 24;
export const MAX_NAME_LENGTH = 40;

const DATE_WINDOWS: readonly PresetDateWindow[] = ['none', 'today', 'weekend', 'next7', 'fixed'];
const VIEW_MODES: readonly ViewMode[] = ['grid', 'row', 'map'];
const PAGE_SIZES: readonly PageSize[] = [15, 30, 60];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function emptyPresetFilters(): PresetFilters {
  return {
    search: '',
    categories: [],
    dateWindow: 'none',
    dateFrom: null,
    dateTo: null,
    hourFrom: null,
    hourTo: null,
    freeOnly: false,
    viewMode: 'grid',
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

/**
 * Turn the filters currently on screen into something savable. `page` is
 * dropped on purpose — reopening a preset on page 4 of results it has never
 * shown you is never what was meant — and an absolute date range becomes a
 * 'fixed' window so it round-trips unchanged.
 */
export function presetFiltersFromEventFilters(filters: EventFilters): PresetFilters {
  const hasRange = Boolean(filters.dateFrom || filters.dateTo || filters.dateSingle);
  return {
    search: filters.search,
    categories: [...filters.categories],
    dateWindow: hasRange ? 'fixed' : 'none',
    dateFrom: filters.dateSingle ?? filters.dateFrom,
    dateTo: filters.dateSingle ?? filters.dateTo,
    hourFrom: filters.hourFrom,
    hourTo: filters.hourTo,
    freeOnly: filters.freeOnly,
    viewMode: filters.viewMode,
    pageSize: filters.pageSize,
  };
}

/** Resolve a relative window against `now`. Returns null when there is none. */
export function resolveDateWindow(
  filters: PresetFilters,
  now: Date
): { dateFrom: string; dateTo: string } | null {
  switch (filters.dateWindow) {
    case 'today': {
      const today = toDateString(now);
      return { dateFrom: today, dateTo: today };
    }
    case 'weekend': {
      const { fromDate, toDate } = getUpcomingWeekend(now);
      return { dateFrom: fromDate, dateTo: toDate };
    }
    case 'next7':
      return { dateFrom: toDateString(now), dateTo: toDateString(addDays(now, 7)) };
    case 'fixed': {
      if (!filters.dateFrom && !filters.dateTo) return null;
      // A half-open fixed range is legitimate ("from Friday on"); mirror the
      // present end onto the missing one so the list gets a usable window.
      const from = filters.dateFrom ?? filters.dateTo!;
      const to = filters.dateTo ?? filters.dateFrom!;
      return { dateFrom: from, dateTo: to };
    }
    default:
      return null;
  }
}

/** The query a preset expands to, as the events list would parse it. */
export function presetToEventFilters(preset: FilterPreset, now: Date): Partial<EventFilters> {
  const range = resolveDateWindow(preset.filters, now);
  return {
    search: preset.filters.search,
    categories: preset.filters.categories,
    dateMode: range ? 'range' : null,
    dateFrom: range?.dateFrom ?? null,
    dateTo: range?.dateTo ?? null,
    // The list only honours an hour window alongside a date one, so an hour
    // range saved without a date would silently do nothing.
    hourFrom: range ? preset.filters.hourFrom : null,
    hourTo: range ? preset.filters.hourTo : null,
    freeOnly: preset.filters.freeOnly,
    viewMode: preset.filters.viewMode,
    pageSize: preset.filters.pageSize,
  };
}

/** Where a preset tile points. Relative windows resolve against `now`. */
export function presetHref(preset: FilterPreset, now: Date): string {
  const params = filtersToSearchParams(presetToEventFilters(preset, now));
  const query = params.toString();
  return `/${preset.cityId}/wydarzenia${query ? `?${query}` : ''}`;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asPattern(value: unknown, pattern: RegExp): string | null {
  return typeof value === 'string' && pattern.test(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function parsePresetFilters(raw: unknown): PresetFilters {
  const base = emptyPresetFilters();
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Record<string, unknown>;
  const dateWindow = DATE_WINDOWS.includes(value.dateWindow as PresetDateWindow)
    ? (value.dateWindow as PresetDateWindow)
    : 'none';
  return {
    search: asString(value.search),
    categories: asStringArray(value.categories),
    dateWindow,
    dateFrom: asPattern(value.dateFrom, DATE_REGEX),
    dateTo: asPattern(value.dateTo, DATE_REGEX),
    hourFrom: asPattern(value.hourFrom, TIME_REGEX),
    hourTo: asPattern(value.hourTo, TIME_REGEX),
    freeOnly: value.freeOnly === true,
    viewMode: VIEW_MODES.includes(value.viewMode as ViewMode) ? (value.viewMode as ViewMode) : 'grid',
    pageSize: PAGE_SIZES.includes(value.pageSize as PageSize)
      ? (value.pageSize as PageSize)
      : DEFAULT_PAGE_SIZE,
  };
}

/**
 * Read presets out of whatever localStorage happens to hold.
 *
 * That value is user-writable and survives every future version of this code,
 * so it is treated as untrusted input: anything unparseable yields an empty
 * list, and anything merely malformed is repaired field by field rather than
 * discarding the user's other presets along with it.
 */
export function parsePresets(raw: string | null): FilterPreset[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const presets: FilterPreset[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Record<string, unknown>;
    const id = asString(value.id);
    const cityId = asString(value.cityId);
    // No id means no stable handle for edit or delete; no city means no route
    // to open. Neither is repairable, so those entries are dropped.
    if (!id || !cityId || seen.has(id)) continue;
    seen.add(id);
    presets.push({
      id,
      name: asString(value.name).slice(0, MAX_NAME_LENGTH),
      cityId,
      filters: parsePresetFilters(value.filters),
      createdAt: asString(value.createdAt),
    });
  }
  return presets.slice(0, MAX_PRESETS);
}

export function serializePresets(presets: FilterPreset[]): string {
  return JSON.stringify(presets);
}

/**
 * An id for a new preset. crypto.randomUUID needs a secure context, which the
 * deployed site and localhost both are — but a plain-http preview is not, and
 * losing the ability to save a filter there would be a silly way to fail.
 */
export function newPresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Insert or replace by id, newest first, capped at MAX_PRESETS. */
export function upsertPreset(presets: FilterPreset[], preset: FilterPreset): FilterPreset[] {
  const index = presets.findIndex((p) => p.id === preset.id);
  if (index >= 0) {
    const next = [...presets];
    next[index] = preset;
    return next;
  }
  return [preset, ...presets].slice(0, MAX_PRESETS);
}

export function removePreset(presets: FilterPreset[], id: string): FilterPreset[] {
  return presets.filter((p) => p.id !== id);
}

/**
 * A copy placed directly after its original, so "start from this one and change
 * a thing" does not mean retyping the whole filter set.
 */
export function duplicatePreset(
  presets: FilterPreset[],
  id: string,
  newId: string,
  name: string,
  createdAt: string
): FilterPreset[] {
  const index = presets.findIndex((p) => p.id === id);
  if (index < 0) return presets;
  if (presets.length >= MAX_PRESETS) return presets;
  const copy: FilterPreset = {
    ...presets[index],
    id: newId,
    name: name.slice(0, MAX_NAME_LENGTH),
    filters: { ...presets[index].filters, categories: [...presets[index].filters.categories] },
    createdAt,
  };
  const next = [...presets];
  next.splice(index + 1, 0, copy);
  return next;
}

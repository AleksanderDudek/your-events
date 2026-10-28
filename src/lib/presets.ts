import { EventFilters, NearFilter, PageSize, ViewMode, Weekday } from '@/types/filter.types';
import { FilterPreset, PresetDateWindow, PresetFilters } from '@/types/preset.types';
import { filtersToSearchParams, parseNear } from './filterUtils';
import { hasDateValue, relativeWindowFilters, resolveRelativeWindow } from './dateWindows';
import { sortWeekdays } from './weekdays';
import { parseSeasonSlug } from './seasons';
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

export function emptyPresetFilters(): PresetFilters {
  return {
    search: '',
    categories: [],
    dateWindow: 'none',
    dateFrom: null,
    dateTo: null,
    weekdays: [],
    hourFrom: null,
    hourTo: null,
    freeOnly: false,
    near: null,
    season: null,
    viewMode: 'grid',
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

/**
 * Turn the filters currently on screen into something savable. `page` is
 * dropped on purpose — reopening a preset on page 4 of results it has never
 * shown you is never what was meant.
 *
 * `dateWindow` says how the dates on screen should be kept: as the exact
 * dates ('fixed', the default whenever there are any), as a relative window
 * re-resolved on every open (the dates themselves are then not stored), or not
 * at all. A fixed window with no dates to fix is no window.
 */
export function presetFiltersFromEventFilters(
  filters: EventFilters,
  dateWindow?: PresetDateWindow
): PresetFilters {
  const hasRange = hasDateValue(filters);
  const requested = dateWindow ?? (hasRange ? 'fixed' : 'none');
  const window = requested === 'fixed' && !hasRange ? 'none' : requested;
  const isFixed = window === 'fixed';
  // The list only honours an hour range alongside a date, so one saved with no
  // window would sit unseen in the preset and come back if a window were added.
  const keepsHours = window !== 'none';
  return {
    search: filters.search,
    categories: [...filters.categories],
    dateWindow: window,
    dateFrom: isFixed ? (filters.dateSingle ?? filters.dateFrom) : null,
    dateTo: isFixed ? (filters.dateSingle ?? filters.dateTo) : null,
    weekdays: [...filters.weekdays],
    hourFrom: keepsHours ? filters.hourFrom : null,
    hourTo: keepsHours ? filters.hourTo : null,
    freeOnly: filters.freeOnly,
    near: filters.near ? { ...filters.near } : null,
    season: filters.season,
    viewMode: filters.viewMode,
    pageSize: filters.pageSize,
  };
}

/**
 * Resolve a preset's window against `now`. Returns null when there is none. A
 * fixed range may be half-open, and stays so: "from Friday on" is a range the
 * list understands as it is.
 */
export function resolveDateWindow(
  filters: PresetFilters,
  now: Date
): { dateFrom: string | null; dateTo: string | null } | null {
  switch (filters.dateWindow) {
    case 'today':
    case 'weekend':
    case 'next7':
      return resolveRelativeWindow(filters.dateWindow, now);
    case 'fixed':
      if (!filters.dateFrom && !filters.dateTo) return null;
      return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
    default:
      return null;
  }
}

/** The query a preset expands to, as the events list would parse it. */
export function presetToEventFilters(preset: FilterPreset, now: Date): Partial<EventFilters> {
  const range = resolveDateWindow(preset.filters, now);
  // Today goes out as a single day, the way the list's own "Dziś" writes it, so
  // the dates read back as today and not as a Sunday's one-day weekend.
  const dates =
    preset.filters.dateWindow === 'today'
      ? relativeWindowFilters('today', now)
      : {
          dateMode: range ? ('range' as const) : null,
          dateSingle: null,
          dateFrom: range?.dateFrom ?? null,
          dateTo: range?.dateTo ?? null,
        };
  return {
    search: preset.filters.search,
    categories: preset.filters.categories,
    ...dates,
    // Unlike the hour range, this one does not need a date window to mean
    // something, so it is carried over as saved.
    weekdays: preset.filters.weekdays,
    // The list only honours an hour window alongside a date one, so an hour
    // range saved without a date would silently do nothing.
    hourFrom: range ? preset.filters.hourFrom : null,
    hourTo: range ? preset.filters.hourTo : null,
    freeOnly: preset.filters.freeOnly,
    near: preset.filters.near,
    season: preset.filters.season,
    viewMode: preset.filters.viewMode,
    pageSize: preset.filters.pageSize,
  };
}

/**
 * A fixed range in words: one day, both ends, or the one end a half-open range
 * has — which must not read as a single day.
 */
export function describeFixedRange(
  from: string | null,
  to: string | null,
  words: { from: (date: string) => string; to: (date: string) => string }
): string {
  if (from && to) return from === to ? from : `${from} – ${to}`;
  if (from) return words.from(from);
  if (to) return words.to(to);
  return '';
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

function asWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  const days = value.filter(
    (v): v is Weekday => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6
  );
  return sortWeekdays(days);
}

// Stored presets are untrusted input (see parsePresets), and a point is opened
// by turning it into a query string — so it passes the URL's own gate.
function asNear(value: unknown): NearFilter | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.lat !== 'number' || typeof v.lng !== 'number') return null;
  return parseNear(
    `${v.lat},${v.lng}`,
    typeof v.radius === 'number' ? String(v.radius) : null,
    typeof v.label === 'string' ? v.label : null
  );
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
    weekdays: asWeekdays(value.weekdays),
    hourFrom: asPattern(value.hourFrom, TIME_REGEX),
    hourTo: asPattern(value.hourTo, TIME_REGEX),
    freeOnly: value.freeOnly === true,
    near: asNear(value.near),
    // Presets saved before seasons existed have none; junk is dropped.
    season: parseSeasonSlug(typeof value.season === 'string' ? value.season : null),
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
    filters: {
      ...presets[index].filters,
      categories: [...presets[index].filters.categories],
      weekdays: [...presets[index].filters.weekdays],
      near: presets[index].filters.near ? { ...presets[index].filters.near } : null,
    },
    createdAt,
  };
  const next = [...presets];
  next.splice(index + 1, 0, copy);
  return next;
}

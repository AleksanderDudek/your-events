import { describe, it, expect } from 'vitest';
import {
  MAX_NAME_LENGTH,
  MAX_PRESETS,
  duplicatePreset,
  emptyPresetFilters,
  parsePresets,
  presetFiltersFromEventFilters,
  presetHref,
  presetToEventFilters,
  removePreset,
  resolveDateWindow,
  serializePresets,
  upsertPreset,
} from './presets';
import { getDefaultFilters } from './filterUtils';
import type { FilterPreset } from '@/types/preset.types';

function makePreset(overrides: Partial<FilterPreset> = {}): FilterPreset {
  return {
    id: 'p1',
    name: 'Weekend',
    cityId: 'wroclaw',
    filters: emptyPresetFilters(),
    createdAt: '2026-07-27T10:00:00.000Z',
    ...overrides,
  };
}

// A Monday, so relative windows have somewhere unambiguous to land.
const MONDAY = new Date(2026, 6, 27, 12, 0, 0);

describe('resolveDateWindow', () => {
  it('resolves "today" against now, not against the save date', () => {
    expect(resolveDateWindow({ ...emptyPresetFilters(), dateWindow: 'today' }, MONDAY)).toEqual({
      dateFrom: '2026-07-27',
      dateTo: '2026-07-27',
    });
  });

  it('resolves "weekend" to the upcoming one', () => {
    const range = resolveDateWindow({ ...emptyPresetFilters(), dateWindow: 'weekend' }, MONDAY);
    expect(range).toEqual({ dateFrom: '2026-07-31', dateTo: '2026-08-02' });
  });

  it('resolves "next7" to a week from now', () => {
    expect(resolveDateWindow({ ...emptyPresetFilters(), dateWindow: 'next7' }, MONDAY)).toEqual({
      dateFrom: '2026-07-27',
      dateTo: '2026-08-03',
    });
  });

  it('moves with the calendar — the same preset resolves differently next week', () => {
    // This is the property that makes a preset worth more than a saved URL.
    const filters = { ...emptyPresetFilters(), dateWindow: 'weekend' as const };
    const thisWeek = resolveDateWindow(filters, MONDAY);
    const nextWeek = resolveDateWindow(filters, new Date(2026, 7, 3, 12, 0, 0));
    expect(nextWeek).not.toEqual(thisWeek);
  });

  it('returns null when the preset carries no date filter', () => {
    expect(resolveDateWindow(emptyPresetFilters(), MONDAY)).toBeNull();
  });

  it('mirrors a half-open fixed range onto its missing end', () => {
    const filters = { ...emptyPresetFilters(), dateWindow: 'fixed' as const, dateFrom: '2026-08-10', dateTo: null };
    expect(resolveDateWindow(filters, MONDAY)).toEqual({
      dateFrom: '2026-08-10',
      dateTo: '2026-08-10',
    });
  });

  it('returns null for a fixed window with no dates at all', () => {
    expect(
      resolveDateWindow({ ...emptyPresetFilters(), dateWindow: 'fixed' }, MONDAY)
    ).toBeNull();
  });
});

describe('presetToEventFilters', () => {
  it('drops an hour window when there is no date window to hang it on', () => {
    // The events list only applies hourFrom/hourTo alongside a date, so keeping
    // them here would show the user a filter that quietly does nothing.
    const preset = makePreset({
      filters: { ...emptyPresetFilters(), hourFrom: '18:00', hourTo: '22:00' },
    });
    const filters = presetToEventFilters(preset, MONDAY);
    expect(filters.hourFrom).toBeNull();
    expect(filters.hourTo).toBeNull();
  });

  it('keeps the hour window once a date window exists', () => {
    const preset = makePreset({
      filters: {
        ...emptyPresetFilters(),
        dateWindow: 'today',
        hourFrom: '18:00',
        hourTo: '22:00',
      },
    });
    const filters = presetToEventFilters(preset, MONDAY);
    expect(filters).toMatchObject({ dateMode: 'range', hourFrom: '18:00', hourTo: '22:00' });
  });
});

describe('presetHref', () => {
  it('points at the preset\'s own city', () => {
    expect(presetHref(makePreset({ cityId: 'szczecin' }), MONDAY)).toMatch(
      /^\/szczecin\/wydarzenia/
    );
  });

  it('carries the filters as query parameters', () => {
    const preset = makePreset({
      filters: {
        ...emptyPresetFilters(),
        categories: ['taniec'],
        dateWindow: 'today',
        freeOnly: true,
      },
    });
    const href = presetHref(preset, MONDAY);
    expect(href).toContain('categories=taniec');
    expect(href).toContain('freeOnly=true');
    expect(href).toContain('dateFrom=2026-07-27');
  });

  it('produces a bare list URL when nothing is filtered', () => {
    expect(presetHref(makePreset(), MONDAY)).toBe('/wroclaw/wydarzenia');
  });

  it('carries a weekday selection even without a date window', () => {
    const preset = makePreset({
      filters: { ...emptyPresetFilters(), weekdays: [1, 5] },
    });
    expect(presetHref(preset, MONDAY)).toContain('weekdays=1%2C5');
  });
});

describe('presetFiltersFromEventFilters', () => {
  it('captures the filters on screen and forgets the page', () => {
    const saved = presetFiltersFromEventFilters({
      ...getDefaultFilters(),
      search: 'salsa',
      categories: ['taniec'],
      page: 4,
    });
    expect(saved).toMatchObject({ search: 'salsa', categories: ['taniec'] });
    expect(saved).not.toHaveProperty('page');
  });

  it('records an explicit date as a fixed window', () => {
    const saved = presetFiltersFromEventFilters({
      ...getDefaultFilters(),
      dateMode: 'single',
      dateSingle: '2026-08-01',
    });
    expect(saved).toMatchObject({ dateWindow: 'fixed', dateFrom: '2026-08-01', dateTo: '2026-08-01' });
  });

  it('keeps the weekday selection, and copies rather than aliases it', () => {
    const filters = { ...getDefaultFilters(), weekdays: [1, 4] as const };
    const saved = presetFiltersFromEventFilters({ ...filters, weekdays: [...filters.weekdays] });
    expect(saved.weekdays).toEqual([1, 4]);
    expect(saved.weekdays).not.toBe(filters.weekdays);
  });
});

describe('parsePresets', () => {
  it('round-trips what it serialised', () => {
    const presets = [makePreset(), makePreset({ id: 'p2', name: 'Taniec' })];
    expect(parsePresets(serializePresets(presets))).toEqual(presets);
  });

  it('yields an empty list for junk rather than throwing', () => {
    // The value is user-writable and outlives this code; a crash here would
    // take the whole page down.
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets('not json')).toEqual([]);
    expect(parsePresets('{"nope":true}')).toEqual([]);
    expect(parsePresets('[1,2,3]')).toEqual([]);
  });

  it('repairs a malformed preset instead of discarding the whole list', () => {
    const raw = JSON.stringify([
      { id: 'p1', cityId: 'wroclaw', name: 'Ok', filters: { categories: 'not-an-array', dateWindow: 'bogus' } },
      { id: 'p2', cityId: 'wroclaw', name: 'Also ok' },
    ]);
    const presets = parsePresets(raw);
    expect(presets).toHaveLength(2);
    expect(presets[0].filters.categories).toEqual([]);
    expect(presets[0].filters.dateWindow).toBe('none');
  });

  it('keeps only real day numbers out of a stored weekday list', () => {
    const raw = JSON.stringify([
      { id: 'p1', cityId: 'wroclaw', name: 'Ok', filters: { weekdays: [5, 9, '1', null, 0] } },
    ]);
    expect(parsePresets(raw)[0].filters.weekdays).toEqual([5, 0]);
  });

  it('drops entries with no id or no city — neither can be opened or edited', () => {
    const raw = JSON.stringify([
      { cityId: 'wroclaw', name: 'No id' },
      { id: 'p2', name: 'No city' },
      { id: 'p3', cityId: 'wroclaw', name: 'Fine' },
    ]);
    expect(parsePresets(raw).map((p) => p.id)).toEqual(['p3']);
  });

  it('drops duplicate ids, which would break edit and delete', () => {
    const raw = JSON.stringify([
      { id: 'p1', cityId: 'wroclaw', name: 'First' },
      { id: 'p1', cityId: 'wroclaw', name: 'Shadow' },
    ]);
    expect(parsePresets(raw)).toHaveLength(1);
  });

  it('caps a runaway list and truncates an over-long name', () => {
    const raw = JSON.stringify(
      Array.from({ length: MAX_PRESETS + 10 }, (_, i) => ({
        id: `p${i}`,
        cityId: 'wroclaw',
        name: 'x'.repeat(MAX_NAME_LENGTH + 20),
      }))
    );
    const presets = parsePresets(raw);
    expect(presets).toHaveLength(MAX_PRESETS);
    expect(presets[0].name).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('upsertPreset', () => {
  it('adds a new preset at the front', () => {
    const next = upsertPreset([makePreset()], makePreset({ id: 'p2' }));
    expect(next.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('replaces in place, keeping the position', () => {
    const list = [makePreset({ id: 'a' }), makePreset({ id: 'b' }), makePreset({ id: 'c' })];
    const next = upsertPreset(list, makePreset({ id: 'b', name: 'Renamed' }));
    expect(next.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(next[1].name).toBe('Renamed');
  });

  it('refuses to grow past the cap', () => {
    const full = Array.from({ length: MAX_PRESETS }, (_, i) => makePreset({ id: `p${i}` }));
    expect(upsertPreset(full, makePreset({ id: 'new' }))).toHaveLength(MAX_PRESETS);
  });
});

describe('removePreset', () => {
  it('removes by id and leaves the rest alone', () => {
    const list = [makePreset({ id: 'a' }), makePreset({ id: 'b' })];
    expect(removePreset(list, 'a').map((p) => p.id)).toEqual(['b']);
    expect(removePreset(list, 'nope')).toHaveLength(2);
  });
});

describe('duplicatePreset', () => {
  it('places the copy right after its original', () => {
    const list = [makePreset({ id: 'a' }), makePreset({ id: 'b' })];
    const next = duplicatePreset(list, 'a', 'a-copy', 'Kopia', '2026-07-27T11:00:00.000Z');
    expect(next.map((p) => p.id)).toEqual(['a', 'a-copy', 'b']);
  });

  it('copies the filters rather than sharing them', () => {
    const list = [makePreset({ id: 'a', filters: { ...emptyPresetFilters(), categories: ['taniec'] } })];
    const next = duplicatePreset(list, 'a', 'a-copy', 'Kopia', '2026-07-27T11:00:00.000Z');
    next[1].filters.categories.push('muzyka');
    expect(next[0].filters.categories).toEqual(['taniec']);
  });

  it('is a no-op for an unknown id or a full list', () => {
    const list = [makePreset({ id: 'a' })];
    expect(duplicatePreset(list, 'nope', 'x', 'Kopia', 'now')).toEqual(list);
    const full = Array.from({ length: MAX_PRESETS }, (_, i) => makePreset({ id: `p${i}` }));
    expect(duplicatePreset(full, 'p0', 'x', 'Kopia', 'now')).toHaveLength(MAX_PRESETS);
  });
});

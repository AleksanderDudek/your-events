import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WINDOW_MONTHS,
  defaultDateWindow,
  hasDateValue,
  inferDateWindow,
  matchRelativeWindow,
  relativeWindowFilters,
  resolveRelativeWindow,
  withDefaultDateWindow,
} from './dateWindows';
import { getDefaultFilters } from './filterUtils';
import type { EventFilters } from '@/types/filter.types';

// A Monday, so relative windows have somewhere unambiguous to land.
const MONDAY = new Date(2026, 6, 27, 12, 0, 0);

function filtersWith(overrides: Partial<EventFilters>): EventFilters {
  return { ...getDefaultFilters(), ...overrides };
}

describe('defaultDateWindow', () => {
  it('runs from today to three months ahead', () => {
    expect(DEFAULT_WINDOW_MONTHS).toBe(3);
    expect(defaultDateWindow(MONDAY)).toEqual({ dateFrom: '2026-07-27', dateTo: '2026-10-27' });
  });

  it('clamps to the end of a shorter month rather than spilling into the next', () => {
    expect(defaultDateWindow(new Date(2026, 10, 30, 9, 0, 0))).toEqual({
      dateFrom: '2026-11-30',
      dateTo: '2027-02-28',
    });
  });

  it('uses the local calendar day late in the evening', () => {
    // 23:30 local is already the next day in UTC for anyone east of Greenwich;
    // the window must still start on the day the visitor is living in.
    expect(defaultDateWindow(new Date(2026, 6, 27, 23, 30, 0)).dateFrom).toBe('2026-07-27');
  });
});

describe('hasDateValue', () => {
  it('is false with no dates, whatever the mode says', () => {
    expect(hasDateValue(getDefaultFilters())).toBe(false);
    expect(hasDateValue(filtersWith({ dateMode: 'range' }))).toBe(false);
    expect(hasDateValue(filtersWith({ dateMode: 'single' }))).toBe(false);
  });

  it('is true with any one date', () => {
    expect(hasDateValue(filtersWith({ dateMode: 'single', dateSingle: '2026-07-27' }))).toBe(true);
    expect(hasDateValue(filtersWith({ dateMode: 'range', dateFrom: '2026-07-27' }))).toBe(true);
    expect(hasDateValue(filtersWith({ dateMode: 'range', dateTo: '2026-07-27' }))).toBe(true);
  });
});

describe('withDefaultDateWindow', () => {
  it('fills today → +3 months when no date is chosen', () => {
    const out = withDefaultDateWindow(getDefaultFilters(), MONDAY);
    expect(out.dateFrom).toBe('2026-07-27');
    expect(out.dateTo).toBe('2026-10-27');
    expect(out.dateSingle).toBeNull();
  });

  it('leaves the date mode alone, so an hour range keeps its existing rule', () => {
    expect(withDefaultDateWindow(getDefaultFilters(), MONDAY).dateMode).toBeNull();
    expect(withDefaultDateWindow(filtersWith({ dateMode: 'range' }), MONDAY).dateMode).toBe('range');
  });

  it('applies when a mode was picked but no date yet', () => {
    const out = withDefaultDateWindow(filtersWith({ dateMode: 'range' }), MONDAY);
    expect(out.dateFrom).toBe('2026-07-27');
    expect(out.dateTo).toBe('2026-10-27');
  });

  it('respects an explicit date, even one in the past', () => {
    const single = filtersWith({ dateMode: 'single', dateSingle: '2026-07-20' });
    expect(withDefaultDateWindow(single, MONDAY)).toBe(single);
    const open = filtersWith({ dateMode: 'range', dateFrom: '2026-08-01' });
    expect(withDefaultDateWindow(open, MONDAY)).toBe(open);
  });

  it('keeps every other filter as it was', () => {
    const filters = filtersWith({ search: 'jazz', categories: ['taniec'], freeOnly: true, page: 3 });
    expect(withDefaultDateWindow(filters, MONDAY)).toMatchObject({
      search: 'jazz',
      categories: ['taniec'],
      freeOnly: true,
      page: 3,
    });
  });
});

describe('resolveRelativeWindow', () => {
  it('resolves today, the coming weekend and the next seven days', () => {
    expect(resolveRelativeWindow('today', MONDAY)).toEqual({ dateFrom: '2026-07-27', dateTo: '2026-07-27' });
    expect(resolveRelativeWindow('weekend', MONDAY)).toEqual({ dateFrom: '2026-07-31', dateTo: '2026-08-02' });
    expect(resolveRelativeWindow('next7', MONDAY)).toEqual({ dateFrom: '2026-07-27', dateTo: '2026-08-03' });
  });
});

describe('relativeWindowFilters', () => {
  it('writes today as a single day — what the picker would write', () => {
    expect(relativeWindowFilters('today', MONDAY)).toEqual({
      dateMode: 'single',
      dateSingle: '2026-07-27',
      dateFrom: null,
      dateTo: null,
    });
  });

  it('writes the other windows as ranges', () => {
    expect(relativeWindowFilters('weekend', MONDAY)).toEqual({
      dateMode: 'range',
      dateSingle: null,
      dateFrom: '2026-07-31',
      dateTo: '2026-08-02',
    });
  });

  it('round-trips through matchRelativeWindow', () => {
    for (const window of ['today', 'weekend', 'next7'] as const) {
      expect(matchRelativeWindow(relativeWindowFilters(window, MONDAY), MONDAY)).toBe(window);
    }
  });
});

describe('matchRelativeWindow', () => {
  it('recognises today written either way', () => {
    expect(matchRelativeWindow({ dateSingle: '2026-07-27', dateFrom: null, dateTo: null }, MONDAY)).toBe('today');
    expect(
      matchRelativeWindow({ dateSingle: null, dateFrom: '2026-07-27', dateTo: '2026-07-27' }, MONDAY)
    ).toBe('today');
  });

  it('recognises a preset opened today — the same dates it resolves to', () => {
    expect(
      matchRelativeWindow({ dateSingle: null, dateFrom: '2026-07-31', dateTo: '2026-08-02' }, MONDAY)
    ).toBe('weekend');
    expect(
      matchRelativeWindow({ dateSingle: null, dateFrom: '2026-07-27', dateTo: '2026-08-03' }, MONDAY)
    ).toBe('next7');
  });

  it('matches nothing for other dates, half-open ranges or no dates', () => {
    expect(matchRelativeWindow({ dateSingle: '2026-07-28', dateFrom: null, dateTo: null }, MONDAY)).toBeNull();
    expect(matchRelativeWindow({ dateSingle: null, dateFrom: '2026-07-27', dateTo: null }, MONDAY)).toBeNull();
    expect(matchRelativeWindow({ dateSingle: null, dateFrom: null, dateTo: null }, MONDAY)).toBeNull();
  });

  it('tells today from the weekend on a Sunday, when both are that one day', () => {
    // "Dziś" writes a single day, "Ten weekend" a range; that difference is
    // all there is to go on, and it is enough.
    const sunday = new Date(2026, 7, 2, 12, 0, 0);
    expect(matchRelativeWindow({ dateSingle: '2026-08-02', dateFrom: null, dateTo: null }, sunday)).toBe('today');
    expect(
      matchRelativeWindow({ dateSingle: null, dateFrom: '2026-08-02', dateTo: '2026-08-02' }, sunday)
    ).toBe('weekend');
    for (const window of ['today', 'weekend', 'next7'] as const) {
      expect(matchRelativeWindow(relativeWindowFilters(window, sunday), sunday)).toBe(window);
    }
  });
});

describe('inferDateWindow', () => {
  it('is none with no dates', () => {
    expect(inferDateWindow(getDefaultFilters(), MONDAY)).toBe('none');
    expect(inferDateWindow(filtersWith({ dateMode: 'range' }), MONDAY)).toBe('none');
  });

  it('is the relative window the dates match', () => {
    expect(inferDateWindow(filtersWith({ dateMode: 'single', dateSingle: '2026-07-27' }), MONDAY)).toBe('today');
    expect(
      inferDateWindow(filtersWith({ dateMode: 'range', dateFrom: '2026-07-31', dateTo: '2026-08-02' }), MONDAY)
    ).toBe('weekend');
  });

  it('is fixed for any other dates', () => {
    expect(inferDateWindow(filtersWith({ dateMode: 'single', dateSingle: '2026-08-15' }), MONDAY)).toBe('fixed');
    expect(inferDateWindow(filtersWith({ dateMode: 'range', dateFrom: '2026-08-01' }), MONDAY)).toBe('fixed');
  });
});

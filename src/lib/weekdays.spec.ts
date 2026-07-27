import { describe, it, expect } from 'vitest';
import {
  WEEKDAY_HORIZON_DAYS,
  WEEKDAY_ORDER,
  expandWeekdayDates,
  parseWeekdays,
  serializeWeekdays,
  sortWeekdays,
} from './weekdays';
import type { Weekday } from '@/types/filter.types';

// A Monday, so offsets in the assertions below read as plain weekday counts.
const MONDAY = new Date(2026, 6, 27, 14, 30);

describe('parseWeekdays', () => {
  it('returns nothing for an absent or empty parameter', () => {
    expect(parseWeekdays(null)).toEqual([]);
    expect(parseWeekdays('')).toEqual([]);
  });

  it('keeps only day numbers in range', () => {
    expect(parseWeekdays('1,7,-2,abc,3')).toEqual([1, 3]);
  });

  it('canonicalises order and drops duplicates', () => {
    expect(parseWeekdays('5,1,0,1')).toEqual([1, 5, 0]);
  });
});

describe('serializeWeekdays', () => {
  it('writes the selection Monday-first regardless of input order', () => {
    expect(serializeWeekdays([0, 5, 1])).toBe('1,5,0');
  });

  it('round-trips through parseWeekdays', () => {
    const picked: Weekday[] = [2, 4, 6];
    expect(parseWeekdays(serializeWeekdays(picked))).toEqual(picked);
  });
});

describe('sortWeekdays', () => {
  it('puts Sunday last', () => {
    expect(sortWeekdays([0, 6, 1])).toEqual([1, 6, 0]);
  });
});

describe('expandWeekdayDates', () => {
  it('is a no-op when nothing is selected', () => {
    expect(expandWeekdayDates([], { from: null, to: null }, MONDAY)).toBeNull();
  });

  it('is a no-op when every day is selected', () => {
    expect(expandWeekdayDates(WEEKDAY_ORDER, { from: null, to: null }, MONDAY)).toBeNull();
  });

  it('lists the matching dates inside an explicit range', () => {
    expect(
      expandWeekdayDates([1, 3], { from: '2026-07-27', to: '2026-08-05' }, MONDAY)
    ).toEqual(['2026-07-27', '2026-07-29', '2026-08-03', '2026-08-05']);
  });

  it('includes both ends of the range', () => {
    expect(expandWeekdayDates([1], { from: '2026-07-27', to: '2026-07-27' }, MONDAY)).toEqual([
      '2026-07-27',
    ]);
  });

  it('returns an empty list — not a no-op — when the range holds no such day', () => {
    // Mon 27th – Tue 28th, filtered to Sundays: the query must return nothing,
    // which is a different answer from "do not narrow the query".
    expect(expandWeekdayDates([0], { from: '2026-07-27', to: '2026-07-28' }, MONDAY)).toEqual([]);
  });

  it('starts from today when the range is open at the start', () => {
    const dates = expandWeekdayDates([1], { from: null, to: '2026-08-10' }, MONDAY)!;
    expect(dates[0]).toBe('2026-07-27');
    expect(dates).toEqual(['2026-07-27', '2026-08-03', '2026-08-10']);
  });

  it('stops at the horizon when the range is open at the end', () => {
    const dates = expandWeekdayDates([1], { from: null, to: null }, MONDAY)!;
    expect(dates).toHaveLength(Math.floor(WEEKDAY_HORIZON_DAYS / 7) + 1);
    expect(dates[0]).toBe('2026-07-27');
    expect(dates.at(-1)).toBe('2027-01-18');
  });

  it('does not let an explicit end date reach past the horizon', () => {
    const dates = expandWeekdayDates([1], { from: '2026-07-27', to: '2030-01-01' }, MONDAY)!;
    expect(dates.at(-1)).toBe('2027-01-18');
  });

  it('ignores a malformed bound rather than producing invalid dates', () => {
    const dates = expandWeekdayDates([1], { from: 'not-a-date', to: '2026-08-03' }, MONDAY)!;
    expect(dates).toEqual(['2026-07-27', '2026-08-03']);
  });

  it('is unaffected by the time of day of `now`', () => {
    const lateEvening = new Date(2026, 6, 27, 23, 59);
    expect(expandWeekdayDates([1], { from: null, to: '2026-08-03' }, lateEvening)).toEqual([
      '2026-07-27',
      '2026-08-03',
    ]);
  });
});

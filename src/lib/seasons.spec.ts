import { describe, it, expect } from 'vitest';
import {
  isSeasonInWindow,
  isSeasonUpcoming,
  parseSeasonSlug,
  seasonNameFromSlug,
  seasonTheme,
  seasonsInWindow,
} from './seasons';
import type { Season } from '@/types/season.types';

const HALLOWEEN: Season = {
  slug: 'halloween',
  name: 'Halloween',
  emoji: '🎃',
  description: 'Imprezy i bale przebierańców.',
  dateFrom: '2026-10-15',
  dateTo: '2026-11-02',
  showFrom: '2026-10-10',
  sort: 10,
};

const SWIETA: Season = {
  ...HALLOWEEN,
  slug: 'swieta',
  name: 'Święta',
  emoji: '🎄',
  dateFrom: '2026-11-15',
  dateTo: '2026-12-26',
  showFrom: '2026-11-10',
  sort: 20,
};

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

describe('parseSeasonSlug', () => {
  it('accepts a plain slug', () => {
    expect(parseSeasonSlug('halloween')).toBe('halloween');
    expect(parseSeasonSlug('dzien-dziecka-2027')).toBe('dzien-dziecka-2027');
  });

  it('rejects anything that could reshape the array filter, and empty values', () => {
    for (const bad of ['', null, undefined, 'a,b', '{x}', 'Halloween', 'a"b', 'a b', 'x'.repeat(41)]) {
      expect(parseSeasonSlug(bad)).toBeNull();
    }
  });
});

describe('isSeasonInWindow', () => {
  it('opens on show_from, before the season starts', () => {
    expect(isSeasonInWindow(HALLOWEEN, day(2026, 10, 9))).toBe(false);
    expect(isSeasonInWindow(HALLOWEEN, day(2026, 10, 10))).toBe(true);
  });

  it('includes the last day and closes the day after', () => {
    expect(isSeasonInWindow(HALLOWEEN, day(2026, 11, 2, 23))).toBe(true);
    expect(isSeasonInWindow(HALLOWEEN, day(2026, 11, 3, 0))).toBe(false);
  });
});

describe('isSeasonUpcoming', () => {
  it('is upcoming while announced, and not once it has started', () => {
    expect(isSeasonUpcoming(HALLOWEEN, day(2026, 10, 12))).toBe(true);
    expect(isSeasonUpcoming(HALLOWEEN, day(2026, 10, 15))).toBe(false);
    expect(isSeasonUpcoming(HALLOWEEN, day(2026, 10, 31))).toBe(false);
  });
});

describe('seasonsInWindow', () => {
  it('keeps the seasons the calendar allows, in configured order', () => {
    const late = { ...SWIETA, showFrom: '2026-10-01', sort: 5 };
    expect(seasonsInWindow([HALLOWEEN, late], day(2026, 10, 28)).map((s) => s.slug)).toEqual([
      'swieta',
      'halloween',
    ]);
    expect(seasonsInWindow([HALLOWEEN, SWIETA], day(2026, 10, 28)).map((s) => s.slug)).toEqual([
      'halloween',
    ]);
    expect(seasonsInWindow([HALLOWEEN, SWIETA], day(2027, 1, 5))).toEqual([]);
  });

  it('does not reorder the array it was given', () => {
    const input = [SWIETA, { ...HALLOWEEN, showFrom: '2026-11-10', dateTo: '2026-12-26' }];
    seasonsInWindow(input, day(2026, 11, 20));
    expect(input[0].slug).toBe('swieta');
  });
});

describe('seasonTheme', () => {
  it('styles the known seasons and falls back for new ones', () => {
    expect(seasonTheme('halloween')).toBe('halloween');
    expect(seasonTheme('swieta')).toBe('swieta');
    expect(seasonTheme('walentynki')).toBe('default');
  });
});

describe('seasonNameFromSlug', () => {
  it('makes a readable name out of a slug', () => {
    expect(seasonNameFromSlug('halloween')).toBe('Halloween');
    expect(seasonNameFromSlug('dzien-dziecka')).toBe('Dzien dziecka');
  });
});

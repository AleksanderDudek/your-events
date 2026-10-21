import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  slugify,
  categoryColorVar,
  categoryColorInkVar,
  categoryFallbackImage,
  formatDate,
  formatDateShort,
  formatDateMedium,
  formatMonth,
  formatDay,
  formatDistance,
  formatEventDistance,
} from './utils';
import type { Event } from '@/types/event.types';

describe('slugify', () => {
  it('strips Polish diacritics and lowercases', () => {
    expect(slugify('Wellness i Duchowość')).toBe('wellness-i-duchowosc');
    expect(slugify('Sport i Fitness')).toBe('sport-i-fitness');
    expect(slugify('Zwierzęta')).toBe('zwierzeta');
  });
});

describe('categoryColorVar', () => {
  it('maps a display name to its --cat var with a fallback', () => {
    expect(categoryColorVar('Muzyka', '#000')).toBe('var(--cat-muzyka, #000)');
  });
  it('uses a neutral fallback when none supplied', () => {
    expect(categoryColorVar('Taniec')).toBe('var(--cat-taniec, #8a8494)');
  });
});

describe('categoryColorInkVar', () => {
  it('maps a display name to its darker --cat-*-ink label var', () => {
    expect(categoryColorInkVar('Warsztaty')).toBe('var(--cat-warsztaty-ink, #5f5968)');
  });
});

describe('categoryFallbackImage', () => {
  it('returns a deterministic 1..10 variant path for a category + seed', () => {
    const a = categoryFallbackImage('Taniec', 'evt-001');
    const b = categoryFallbackImage('Taniec', 'evt-001');
    expect(a).toBe(b); // deterministic
    expect(a).toMatch(/^\/fallbacks\/taniec-([1-9]|10)\.webp$/);
  });
  it('borrows the Edukacja art for Literatura until it has its own set', () => {
    const p = categoryFallbackImage('Literatura', 'evt-001');
    expect(p).toMatch(/^\/fallbacks\/edukacja-([1-9]|10)\.webp$/);
    const file = path.join(process.cwd(), 'public', p);
    expect(existsSync(file)).toBe(true);
  });
  it('varies the variant by seed', () => {
    const paths = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => categoryFallbackImage('Muzyka', s))
    );
    expect(paths.size).toBeGreaterThan(1);
  });

  // The path is built by string concatenation, so a renamed or re-encoded asset
  // set fails silently at runtime (broken image → the solid-colour box). This
  // pins every variant this function can return to a file that exists.
  it('points at a file that exists, for every category and variant', () => {
    const dir = path.join(process.cwd(), 'public', 'fallbacks');
    const categories = Array.from(
      new Set(readdirSync(dir).map((f) => f.replace(/-\d+\.\w+$/, '')))
    );
    expect(categories.length).toBeGreaterThan(0);

    for (const category of categories) {
      for (let variant = 1; variant <= 10; variant += 1) {
        const file = path.join(dir, `${category}-${variant}.webp`);
        expect(existsSync(file), `missing ${file}`).toBe(true);
      }
    }
  });
});

// Dates follow the UI language, not the data. Polish events under an English
// interface still have to read as English, or the language switch is a promise
// the page does not keep.
describe('date formatting follows the locale', () => {
  // A Monday, so the weekday is worth asserting.
  const MONDAY = '2026-08-03';

  it('spells the full date out in the active language', () => {
    expect(formatDate(MONDAY, 'pl')).toBe('poniedziałek, 3 sierpnia 2026');
    expect(formatDate(MONDAY, 'en')).toBe('Monday, 3 August 2026');
  });

  it('shortens the date in the active language', () => {
    expect(formatDateShort(MONDAY, 'pl')).toBe('3 sie');
    expect(formatDateShort(MONDAY, 'en')).toBe('3 Aug');
  });

  it('gives the card badge its month in the active language', () => {
    expect(formatMonth(MONDAY, 'pl')).toBe('SIE');
    expect(formatMonth(MONDAY, 'en')).toBe('AUG');
  });

  it('formats a timestamp down to a plain calendar date', () => {
    expect(formatDateMedium('2026-08-03T09:12:00Z', 'pl')).toBe('3 sie 2026');
    expect(formatDateMedium('2026-08-03T09:12:00Z', 'en')).toBe('3 Aug 2026');
  });

  it('returns null for a timestamp it cannot read', () => {
    expect(formatDateMedium(null, 'en')).toBeNull();
    expect(formatDateMedium('not a date', 'en')).toBeNull();
  });

  // Every existing call site omits the argument, and Polish is the source
  // language — defaulting to it keeps them correct rather than silently English.
  it('defaults to Polish when no locale is given', () => {
    expect(formatDate(MONDAY)).toBe(formatDate(MONDAY, 'pl'));
    expect(formatDateShort(MONDAY)).toBe(formatDateShort(MONDAY, 'pl'));
    expect(formatMonth(MONDAY)).toBe(formatMonth(MONDAY, 'pl'));
  });

  // An unknown locale must not throw an Intl RangeError at render time.
  it('falls back to Polish for a locale it does not know', () => {
    expect(formatMonth(MONDAY, 'de')).toBe('SIE');
  });

  // The day number is a number in every language.
  it('leaves the day number alone', () => {
    expect(formatDay(MONDAY)).toBe('3');
  });
});

describe('formatDistance', () => {
  it('says metres under a kilometre, rounded to tens', () => {
    expect(formatDistance(847)).toBe('850 m');
    expect(formatDistance(4)).toBe('0 m');
  });

  it('switches to kilometres with one decimal, in the interface language', () => {
    expect(formatDistance(1500, 'pl')).toBe('1,5 km');
    expect(formatDistance(1500, 'en')).toBe('1.5 km');
  });

  it('drops a trailing zero, so a whole radius reads "2 km"', () => {
    expect(formatDistance(2000)).toBe('2 km');
  });

  it('rounds 995 m up into kilometres rather than printing "1000 m"', () => {
    expect(formatDistance(995)).toBe('1 km');
  });
});

describe('formatEventDistance', () => {
  const at = (lat: number | null, lng: number | null) =>
    ({ location: { name: 'X', city: 'Wrocław', lat, lng } }) as Event;

  it('formats the distance from the origin to the venue', () => {
    expect(formatEventDistance(at(51.1176, 17.032), { lat: 51.11, lng: 17.032 })).toBe('850 m');
  });

  it('is undefined without an origin or without coordinates', () => {
    expect(formatEventDistance(at(51.11, 17.032), null)).toBeUndefined();
    expect(formatEventDistance(at(null, null), { lat: 51.11, lng: 17.032 })).toBeUndefined();
  });
});

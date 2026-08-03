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
} from './utils';

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

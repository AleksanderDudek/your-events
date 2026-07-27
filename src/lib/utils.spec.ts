import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { slugify, categoryColorVar, categoryColorInkVar, categoryFallbackImage } from './utils';

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

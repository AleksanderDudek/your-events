import { describe, it, expect } from 'vitest';
import { slugify, categoryColorVar, categoryFallbackImage } from './utils';

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

describe('categoryFallbackImage', () => {
  it('returns a deterministic 1..10 variant path for a category + seed', () => {
    const a = categoryFallbackImage('Taniec', 'evt-001');
    const b = categoryFallbackImage('Taniec', 'evt-001');
    expect(a).toBe(b); // deterministic
    expect(a).toMatch(/^\/fallbacks\/taniec-([1-9]|10)\.png$/);
  });
  it('varies the variant by seed', () => {
    const paths = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => categoryFallbackImage('Muzyka', s))
    );
    expect(paths.size).toBeGreaterThan(1);
  });
});

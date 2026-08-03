import { describe, it, expect, beforeEach } from 'vitest';
import { buildCategoryMix, getMixSeed, MIX_PER_CATEGORY } from './categoryMix';

const buckets = () => [
  ['sport-1', 'sport-2', 'sport-3'],
  ['film-1', 'film-2', 'film-3'],
  ['music-1'],
];

describe('buildCategoryMix', () => {
  it('keeps every event exactly once', () => {
    const mixed = buildCategoryMix(buckets(), 1);
    expect([...mixed].sort()).toEqual(buckets().flat().sort());
  });

  // The point of the whole exercise: the first screen must not be one category.
  it('takes one from every category before any category gets a second', () => {
    const mixed = buildCategoryMix(buckets(), 1);
    const prefix = mixed.slice(0, 3);
    const families = new Set(prefix.map((id) => id.split('-')[0]));
    expect(families.size).toBe(3);
  });

  it('is stable for one seed and different across seeds', () => {
    expect(buildCategoryMix(buckets(), 7)).toEqual(buildCategoryMix(buckets(), 7));
    const seeds = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) => buildCategoryMix(buckets(), s).join())
    );
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('survives empty buckets and no buckets at all', () => {
    expect(buildCategoryMix([[], ['a'], []], 3)).toEqual(['a']);
    expect(buildCategoryMix([], 3)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = buckets();
    buildCategoryMix(input, 5);
    expect(input).toEqual(buckets());
  });

  it('samples three per category', () => {
    expect(MIX_PER_CATEGORY).toBe(3);
  });
});

describe('getMixSeed', () => {
  beforeEach(() => window.sessionStorage.clear());

  // Reshuffling per render would make the page jitter; reshuffling per
  // navigation would make going back show a different list.
  it('is stable within a session', () => {
    expect(getMixSeed()).toBe(getMixSeed());
  });

  it('starts again after the session is cleared', () => {
    const first = getMixSeed();
    window.sessionStorage.clear();
    // Astronomically unlikely to collide, but assert on the storage write
    // rather than on inequality so the test cannot flake.
    getMixSeed();
    expect(window.sessionStorage.getItem('go-to-city.mixSeed')).not.toBeNull();
    expect(typeof first).toBe('number');
  });

  it('survives storage being unavailable', () => {
    const original = window.sessionStorage.getItem;
    window.sessionStorage.getItem = () => {
      throw new Error('private mode');
    };
    expect(typeof getMixSeed()).toBe('number');
    window.sessionStorage.getItem = original;
  });
});

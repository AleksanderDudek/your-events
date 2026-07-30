import { describe, it, expect } from 'vitest';
import { toggleCategorySelection } from './categorySelection';
import type { DbCategory } from '@/types/event.types';

function cat(slug: string, parent_slug: string | null): DbCategory {
  return {
    slug,
    parent_slug,
    display_name: slug,
    display_plural: slug,
    icon: '',
    color: '',
    sort_order: 0,
  };
}

const TAXONOMY: DbCategory[] = [
  cat('sport-i-fitness', null),
  cat('sport-i-fitness/fitness-cardio', 'sport-i-fitness'),
  cat('sport-i-fitness/sporty-druzynowe-widowiska', 'sport-i-fitness'),
  cat('muzyka', null),
  cat('muzyka/koncert', 'muzyka'),
];

const BY_SLUG = new Map(TAXONOMY.map((c) => [c.slug, c]));

describe('toggleCategorySelection', () => {
  it('adds a top-level category to an empty selection', () => {
    expect(toggleCategorySelection([], 'sport-i-fitness', BY_SLUG)).toEqual([
      'sport-i-fitness',
    ]);
  });

  it('removes a category that is already selected', () => {
    expect(
      toggleCategorySelection(['sport-i-fitness', 'muzyka'], 'muzyka', BY_SLUG)
    ).toEqual(['sport-i-fitness']);
  });

  // The reported bug: a parent ORed with one of its children resolves to the
  // parent alone, so the subcategory silently changed nothing.
  it('drops the parent when one of its subcategories is picked', () => {
    expect(
      toggleCategorySelection(
        ['sport-i-fitness'],
        'sport-i-fitness/sporty-druzynowe-widowiska',
        BY_SLUG
      )
    ).toEqual(['sport-i-fitness/sporty-druzynowe-widowiska']);
  });

  it('leaves other top-level categories alone when a subcategory is picked', () => {
    expect(
      toggleCategorySelection(
        ['muzyka', 'sport-i-fitness'],
        'sport-i-fitness/fitness-cardio',
        BY_SLUG
      )
    ).toEqual(['muzyka', 'sport-i-fitness/fitness-cardio']);
  });

  it('keeps sibling subcategories, which union into a wider selection', () => {
    expect(
      toggleCategorySelection(
        ['sport-i-fitness/fitness-cardio'],
        'sport-i-fitness/sporty-druzynowe-widowiska',
        BY_SLUG
      )
    ).toEqual([
      'sport-i-fitness/fitness-cardio',
      'sport-i-fitness/sporty-druzynowe-widowiska',
    ]);
  });

  it('drops every subcategory of a parent that is picked', () => {
    expect(
      toggleCategorySelection(
        [
          'muzyka/koncert',
          'sport-i-fitness/fitness-cardio',
          'sport-i-fitness/sporty-druzynowe-widowiska',
        ],
        'sport-i-fitness',
        BY_SLUG
      )
    ).toEqual(['muzyka/koncert', 'sport-i-fitness']);
  });

  // The taxonomy arrives asynchronously and the URL can carry any slug, so an
  // unresolvable one must still toggle instead of being swallowed.
  it('falls back to a plain toggle for a slug outside the taxonomy', () => {
    expect(toggleCategorySelection(['muzyka'], 'nie-ma-takiej', BY_SLUG)).toEqual([
      'muzyka',
      'nie-ma-takiej',
    ]);
    expect(
      toggleCategorySelection(['muzyka', 'nie-ma-takiej'], 'nie-ma-takiej', BY_SLUG)
    ).toEqual(['muzyka']);
  });

  it('does not mutate the selection it was given', () => {
    const current = ['sport-i-fitness'];
    toggleCategorySelection(current, 'sport-i-fitness/fitness-cardio', BY_SLUG);
    expect(current).toEqual(['sport-i-fitness']);
  });
});

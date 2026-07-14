import { describe, it, expect } from 'vitest';
import {
  nameSlug,
  shortId,
  buildCategorySlugMap,
  resolveCategorySlug,
  eventPath,
  CATEGORY_FALLBACK_SLUG,
} from './slug';
import type { Event } from '@/types/event.types';

describe('nameSlug', () => {
  it('lowercases, folds Polish diacritics and hyphenates', () => {
    expect(nameSlug('Joga Kręgosłupa')).toBe('joga-kregoslupa');
    expect(nameSlug('Zumba® / Cardio')).toBe('zumba-cardio');
  });
  it('collapses repeats and trims dashes', () => {
    expect(nameSlug('  A  --  B  ')).toBe('a-b');
  });
  it('caps length at 60 chars without a trailing dash', () => {
    const s = nameSlug('x'.repeat(100));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
  it('returns "wydarzenie" for an empty/diacritic-only name', () => {
    expect(nameSlug('   ')).toBe('wydarzenie');
  });
});

describe('shortId', () => {
  it('is deterministic and 8 lowercase hex chars', () => {
    const a = shortId('sha256:7050969c420b');
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(shortId('sha256:7050969c420b')).toBe(a);
  });
  it('differs for different keys', () => {
    expect(shortId('a')).not.toBe(shortId('b'));
  });
});

describe('buildCategorySlugMap / resolveCategorySlug', () => {
  const cats = [
    { slug: 'muzyka', parent_slug: null, display_name: 'Muzyka' },
    { slug: 'sport-i-fitness', parent_slug: null, display_name: 'Sport i Fitness' },
    { slug: 'koncert', parent_slug: 'muzyka', display_name: 'Koncert' },
  ];
  it('maps top-level display_name to slug (ignores sub-categories)', () => {
    const m = buildCategorySlugMap(cats);
    expect(m.get('Muzyka')).toBe('muzyka');
    expect(m.get('Koncert')).toBeUndefined();
  });
  it('resolves known display_name and falls back for unknown', () => {
    const m = buildCategorySlugMap(cats);
    expect(resolveCategorySlug('Sport i Fitness', m)).toBe('sport-i-fitness');
    expect(resolveCategorySlug('Kultura', m)).toBe(CATEGORY_FALLBACK_SLUG);
    expect(resolveCategorySlug('', m)).toBe(CATEGORY_FALLBACK_SLUG);
  });
});

describe('eventPath', () => {
  const slugMap = new Map([['Muzyka', 'muzyka']]);
  const event = {
    id: '112',
    eventKey: 'https://wroclaw.pl/vsjf-jazzy-tram',
    name: 'VSJF: Jazzy Tram',
    categoryMain: 'Muzyka',
  } as Event;
  it('builds /{city}/{category}/{name}-{shortid}', () => {
    const path = eventPath('wroclaw', event, slugMap);
    expect(path).toMatch(/^\/wroclaw\/muzyka\/vsjf-jazzy-tram-[0-9a-f]{8}$/);
  });
  it('uses the fallback category for unknown category_main', () => {
    const path = eventPath('szczecin', { ...event, categoryMain: 'Kultura' } as Event, slugMap);
    expect(path.startsWith('/szczecin/inne/')).toBe(true);
  });
});

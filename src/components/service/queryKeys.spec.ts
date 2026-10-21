import { describe, it, expect } from 'vitest';
import { eventsKeys } from './queryKeys';
import { getDefaultFilters } from '@/lib/filterUtils';
import type { EventFilters } from '@/types/filter.types';

const filters = (overrides: Partial<EventFilters> = {}): EventFilters => ({
  ...getDefaultFilters(),
  ...overrides,
});

const key = (f: EventFilters) => JSON.stringify(eventsKeys.list('szczecin', f));
const mapKey = (f: EventFilters) => JSON.stringify(eventsKeys.map('szczecin', f));

describe('the list key', () => {
  // Found in a browser, not by a test: every ordering returned the first one's
  // rows, because the key ignored `sort` and react-query happily served the
  // cached page. The ordering is part of what was asked for, so it is part of
  // what identifies the answer.
  it('separates one ordering from another', () => {
    const seen = new Set(
      (['date', 'name', 'venue', 'price'] as const).map((sort) => key(filters({ sort })))
    );
    expect(seen.size).toBe(4);
  });

  it('separates ascending from descending', () => {
    expect(key(filters({ sort: 'name', dir: 'asc' }))).not.toBe(
      key(filters({ sort: 'name', dir: 'desc' }))
    );
  });

  it('still ignores the view mode — grid, list and map render the same rows', () => {
    expect(key(filters({ viewMode: 'grid' }))).toBe(key(filters({ viewMode: 'row' })));
  });
});

describe('the map key', () => {
  // A map has no reading order: every ordering selects the very same pins, so
  // keying on either would throw away the whole pin set to redraw it identically.
  it('ignores the ordering', () => {
    expect(mapKey(filters({ sort: 'name' }))).toBe(mapKey(filters({ sort: 'date' })));
  });

  it('ignores the direction', () => {
    expect(mapKey(filters({ sort: 'name', dir: 'asc' }))).toBe(
      mapKey(filters({ sort: 'name', dir: 'desc' }))
    );
  });

  it('still ignores paging', () => {
    expect(mapKey(filters({ page: 1 }))).toBe(mapKey(filters({ page: 5 })));
  });
});

describe('the proximity filter in the keys', () => {
  const near = { lat: 51.11, lng: 17.032, radius: 1000, label: 'Rynek' };

  it('separates one point, or one radius, from another', () => {
    expect(key(filters({ near }))).not.toBe(key(filters({ near: null })));
    expect(key(filters({ near }))).not.toBe(key(filters({ near: { ...near, lat: 51.12 } })));
    expect(key(filters({ near }))).not.toBe(key(filters({ near: { ...near, radius: 2000 } })));
    expect(mapKey(filters({ near }))).not.toBe(mapKey(filters({ near: { ...near, radius: 2000 } })));
  });

  // Renaming a point does not move it: same question, same cached answer.
  it('ignores the label', () => {
    expect(key(filters({ near }))).toBe(key(filters({ near: { ...near, label: 'Świdnicka' } })));
    expect(mapKey(filters({ near }))).toBe(mapKey(filters({ near: { ...near, label: null } })));
  });
});

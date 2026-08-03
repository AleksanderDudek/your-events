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
      (['mix', 'date', 'name', 'venue', 'price'] as const).map((sort) =>
        key(filters({ sort }))
      )
    );
    expect(seen.size).toBe(5);
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
  // `mix` is not an ordering but a different *set* — a sample of three per
  // category rather than everything — so the map has to know which it is
  // showing, or it would put 748 pins under a 36-event list.
  it('separates the mixed sample from the full set', () => {
    expect(mapKey(filters({ sort: 'mix' }))).not.toBe(mapKey(filters({ sort: 'date' })));
  });

  // Direction is meaningless on a map, and keying on it would throw away the
  // whole pin set to redraw the identical pins.
  it('ignores the direction', () => {
    expect(mapKey(filters({ sort: 'name', dir: 'asc' }))).toBe(
      mapKey(filters({ sort: 'name', dir: 'desc' }))
    );
  });

  it('still ignores paging', () => {
    expect(mapKey(filters({ page: 1 }))).toBe(mapKey(filters({ page: 5 })));
  });
});

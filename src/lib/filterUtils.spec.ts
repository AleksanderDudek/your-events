import { describe, it, expect } from 'vitest';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  getDefaultFilters,
  countActiveFilters,
} from './filterUtils';

const parse = (qs: string) => parseFiltersFromParams(new URLSearchParams(qs));

describe('sort and dir', () => {
  it('default to a mix, ascending', () => {
    expect(parse('')).toMatchObject({ sort: 'mix', dir: 'asc' });
    expect(getDefaultFilters()).toMatchObject({ sort: 'mix', dir: 'asc' });
  });

  it('reads every supported ordering', () => {
    for (const sort of ['mix', 'date', 'name', 'venue', 'price'] as const) {
      expect(parse(`sort=${sort}`).sort).toBe(sort);
    }
    expect(parse('dir=desc').dir).toBe('desc');
  });

  // A hand-edited URL must not reach PostgREST as an unknown column.
  it('falls back to the defaults for junk', () => {
    expect(parse('sort=DROP+TABLE').sort).toBe('mix');
    expect(parse('dir=sideways').dir).toBe('asc');
  });

  it('omits both from the query string when they are at their defaults', () => {
    const qs = filtersToSearchParams({ ...getDefaultFilters() }).toString();
    expect(qs).not.toContain('sort=');
    expect(qs).not.toContain('dir=');
  });

  it('round-trips a non-default ordering', () => {
    const qs = filtersToSearchParams({ ...getDefaultFilters(), sort: 'price', dir: 'desc' }).toString();
    expect(parse(qs)).toMatchObject({ sort: 'price', dir: 'desc' });
  });

  // Ordering is a display preference, like viewMode — not something the
  // "clear filters" button or the active-filter badge should touch.
  it('does not count as an active filter', () => {
    expect(countActiveFilters({ ...getDefaultFilters(), sort: 'price', dir: 'desc' })).toBe(0);
  });
});

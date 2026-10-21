import { describe, it, expect } from 'vitest';
import {
  parseFiltersFromParams,
  filtersToSearchParams,
  getDefaultFilters,
  countActiveFilters,
} from './filterUtils';

const parse = (qs: string) => parseFiltersFromParams(new URLSearchParams(qs));

describe('sort and dir', () => {
  it('default to date, ascending', () => {
    expect(parse('')).toMatchObject({ sort: 'date', dir: 'asc' });
    expect(getDefaultFilters()).toMatchObject({ sort: 'date', dir: 'asc' });
  });

  it('reads every supported ordering', () => {
    for (const sort of ['date', 'name', 'venue', 'price'] as const) {
      expect(parse(`sort=${sort}`).sort).toBe(sort);
    }
    expect(parse('dir=desc').dir).toBe('desc');
  });

  // A hand-edited URL must not reach PostgREST as an unknown column. The
  // retired `mix` ordering goes through the same gate, so links shared while it
  // existed land on the default instead of on nothing.
  it('falls back to the defaults for junk and for retired orderings', () => {
    expect(parse('sort=DROP+TABLE').sort).toBe('date');
    expect(parse('sort=mix').sort).toBe('date');
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

describe('near, radius and nearLabel', () => {
  it('reads a point, its radius and its label', () => {
    expect(parse('near=51.11,17.032&radius=1500&nearLabel=%C5%9Awidnicka+12').near).toEqual({
      lat: 51.11,
      lng: 17.032,
      radius: 1500,
      label: 'Świdnicka 12',
    });
  });

  it('is off without a point, and ignores a radius or label left behind', () => {
    expect(parse('').near).toBeNull();
    expect(parse('radius=1500&nearLabel=Rynek').near).toBeNull();
  });

  it('rejects a point that is not two in-range numbers', () => {
    for (const near of ['51.11', '51.11,17.03,1', 'abc,17', '51.11,', ',17.03', '91,17', '51,181']) {
      expect(parse(`near=${near}`).near).toBeNull();
    }
  });

  it('defaults a missing or junk radius and clamps an out-of-range one', () => {
    expect(parse('near=51.11,17.032').near?.radius).toBe(1000);
    expect(parse('near=51.11,17.032&radius=far').near?.radius).toBe(1000);
    expect(parse('near=51.11,17.032&radius=100').near?.radius).toBe(500);
    expect(parse('near=51.11,17.032&radius=99999').near?.radius).toBe(5000);
  });

  it('rounds the point to four decimals', () => {
    expect(parse('near=51.107949,17.038549').near).toMatchObject({ lat: 51.1079, lng: 17.0385 });
  });

  it('trims the label, caps its length and treats a blank one as absent', () => {
    expect(parse(`near=51.11,17.032&nearLabel=${'x'.repeat(300)}`).near?.label).toHaveLength(100);
    expect(parse('near=51.11,17.032&nearLabel=++').near?.label).toBeNull();
  });

  it('round-trips through the query string', () => {
    const near = { lat: 51.11, lng: 17.032, radius: 2500, label: 'Rynek' };
    const qs = filtersToSearchParams({ ...getDefaultFilters(), near }).toString();
    expect(parse(qs).near).toEqual(near);
  });

  // A shared link should say what it means, not depend on what the default
  // happens to be when it is opened.
  it('writes the radius even at its default, and no label when there is none', () => {
    const qs = filtersToSearchParams({
      ...getDefaultFilters(),
      near: { lat: 51.11, lng: 17.032, radius: 1000, label: null },
    });
    expect(qs.get('near')).toBe('51.11,17.032');
    expect(qs.get('radius')).toBe('1000');
    expect(qs.has('nearLabel')).toBe(false);
  });

  it('counts as one active filter', () => {
    expect(
      countActiveFilters({
        ...getDefaultFilters(),
        near: { lat: 51.11, lng: 17.032, radius: 1000, label: null },
      })
    ).toBe(1);
  });

  it('is off by default', () => {
    expect(getDefaultFilters().near).toBeNull();
  });
});

describe('sorting by distance', () => {
  it('holds while there is a point to measure from', () => {
    expect(parse('near=51.11,17.032&sort=distance').sort).toBe('distance');
  });

  it('reads as the default without one', () => {
    expect(parse('sort=distance').sort).toBe('date');
  });

  it('is not written once its point is gone', () => {
    const qs = filtersToSearchParams({ ...getDefaultFilters(), sort: 'distance', near: null }).toString();
    expect(qs).not.toContain('sort=');
  });
});

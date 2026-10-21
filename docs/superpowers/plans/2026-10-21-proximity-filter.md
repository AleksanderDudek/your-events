# Events Near a Point Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor narrow the events list to those within 500 m – 5 km of a point they set from their device location, an address, or a pin on a map.

**Architecture:** The point and radius live in the URL like every other filter (`near`, `radius`, `nearLabel`). The database narrows to the bounding box of the circle on plain `lat`/`lng` columns; the browser applies the exact circle. A list with any client-side filter (the circle, or the existing `freeOnly`) is resolved by scanning slim rows for matching ids and then fetching whole rows for one page. The spec is `docs/superpowers/specs/2026-10-21-proximity-filter-design.md`.

**Tech Stack:** Next.js 16 static export, React 19, MUI 7, TanStack Query 5, supabase-js 2 (PostgREST), Leaflet 1.9 + react-leaflet 5, Vitest 4 + Testing Library, Playwright. Geocoding: Photon (photon.komoot.io).

**Conventions to keep:** comments explain *why*, in full sentences, at the density of the surrounding code; Polish is the source locale; components take `Readonly<Props>`; tests assert behaviour through roles and visible text. Run everything with pnpm. Commit after every task with a conventional-commit subject and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/geo.ts` (new) | Distance, bounding box, radius limits, coordinate validation/rounding |
| `src/lib/utils.ts` | `formatDistance`, `formatEventDistance` |
| `src/config/cities.ts` | Nearest-city lookup reuses `distanceMeters` |
| `src/types/filter.types.ts` | `NearFilter`, `EventFilters.near`, `SortKey` gains `distance` |
| `src/lib/filterUtils.ts` | `near`/`radius`/`nearLabel` URL contract, `parseNear` |
| `src/components/service/queryKeys.ts` | Point + radius identify a query; the label does not |
| `src/components/service/eventsApi.ts` | Box clause, client filters on raw rows, scan + hydrate, distance order |
| `src/components/service/geocoding.ts` (new) | Photon request and response mapping |
| `src/components/service/useAddressSearch.ts` (new) | Debounced, cached, cancellable suggestions |
| `src/components/service/useGeolocation.ts` (new) | Device fix on request, coarsened; "is this my fix" |
| `src/components/common/EventsMap/markerVisuals.tsx` | Origin marker artwork, circle style |
| `src/components/common/EventsMap/EventsMapInner.tsx`, `EventsMap.tsx`, `.module.scss` | Circle + origin on the events map, framed |
| `src/components/ui/RadiusSlider/` (new) | 500 m–5 km slider, commits on release |
| `src/components/common/LocationPicker/` (new) | Dialog + Leaflet map for dropping a pin |
| `src/components/common/NearbyFilter/` (new) | Panel section: point, three ways in, radius; address autocomplete; place naming |
| `src/components/common/FilterPanel/FilterPanel.tsx` | "W pobliżu" accordion |
| `src/components/ui/EventMeta/`, `EventCard`, `EventRow`, `EventGrid`, `EventList` | Distance beside the venue |
| `src/components/ui/SortSelect/SortSelect.tsx` | "Odległość" option with a point |
| `src/components/views/EventsListView/EventsListView.tsx` | Chip, sort option, circle, distances |
| `src/types/preset.types.ts`, `src/lib/presets.ts`, `src/lib/tourSteps.ts` | Presets keep the point |
| `src/components/views/MyFiltersView/*` | Summary names the point; editor shows/removes it, drops it on city change |
| `src/i18n/messages.ts` | All new strings, PL + EN |
| `src/components/views/PrivacyView/PrivacyView.tsx` | Location section |
| `e2e/nearby.spec.ts` (new), `e2e/support/helpers.ts` | End-to-end coverage |

---

### Task 1: Geometry helpers

**Files:**
- Create: `src/lib/geo.ts`
- Create: `src/lib/geo.spec.ts`
- Modify: `src/config/cities.ts` (`findNearestAvailableCity`, bottom of file)

- [ ] **Step 1: Write the failing test** — `src/lib/geo.spec.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RADIUS_M,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  boundingBox,
  clampRadius,
  distanceMeters,
  isValidLatLng,
  roundCoord,
} from './geo';

// Wrocław: the Rynek and the main station, ~1.35 km apart as the crow flies.
const RYNEK = { lat: 51.11, lng: 17.032 };
const STATION = { lat: 51.0982, lng: 17.0366 };

describe('distanceMeters', () => {
  it('is zero from a point to itself', () => {
    expect(distanceMeters(RYNEK, RYNEK)).toBe(0);
  });

  it('measures a thousandth of a degree of latitude as ~111 m', () => {
    expect(distanceMeters({ lat: 51, lng: 17 }, { lat: 51.001, lng: 17 })).toBeCloseTo(111.2, 0);
  });

  // Meridians converge: at 51°N a degree of longitude is cos(51°) of one of latitude.
  it('shrinks east-west distances with latitude', () => {
    expect(distanceMeters({ lat: 51, lng: 17 }, { lat: 51, lng: 17.001 })).toBeCloseTo(70.0, 0);
  });

  it('is symmetric', () => {
    expect(distanceMeters(RYNEK, STATION)).toBeCloseTo(distanceMeters(STATION, RYNEK), 6);
  });

  it('puts the station 1.3–1.4 km from the Rynek', () => {
    const d = distanceMeters(RYNEK, STATION);
    expect(d).toBeGreaterThan(1300);
    expect(d).toBeLessThan(1400);
  });
});

describe('boundingBox', () => {
  it('reaches exactly the radius north, south, east and west', () => {
    const box = boundingBox(RYNEK, 1000);
    expect(distanceMeters(RYNEK, { lat: box.north, lng: RYNEK.lng })).toBeCloseTo(1000, 3);
    expect(distanceMeters(RYNEK, { lat: box.south, lng: RYNEK.lng })).toBeCloseTo(1000, 3);
    expect(distanceMeters(RYNEK, { lat: RYNEK.lat, lng: box.east })).toBeCloseTo(1000, 1);
    expect(distanceMeters(RYNEK, { lat: RYNEK.lat, lng: box.west })).toBeCloseTo(1000, 1);
  });

  it('is wider in degrees of longitude than of latitude at Polish latitudes', () => {
    const box = boundingBox(RYNEK, 5000);
    expect(box.east - box.west).toBeGreaterThan((box.north - box.south) * 1.5);
  });

  it('lets no point inside the circle fall outside the box', () => {
    const box = boundingBox(RYNEK, 2000);
    for (let bearing = 0; bearing < 360; bearing += 15) {
      // 1999 m out along each bearing, by the small-distance approximation.
      const rad = (bearing * Math.PI) / 180;
      const point = {
        lat: RYNEK.lat + (1999 * Math.cos(rad)) / 111_195,
        lng: RYNEK.lng + (1999 * Math.sin(rad)) / (111_195 * Math.cos((RYNEK.lat * Math.PI) / 180)),
      };
      expect(point.lat).toBeGreaterThanOrEqual(box.south);
      expect(point.lat).toBeLessThanOrEqual(box.north);
      expect(point.lng).toBeGreaterThanOrEqual(box.west);
      expect(point.lng).toBeLessThanOrEqual(box.east);
    }
  });
});

describe('clampRadius', () => {
  it('keeps a radius inside the supported range', () => {
    expect(clampRadius(1500)).toBe(1500);
    expect(clampRadius(100)).toBe(MIN_RADIUS_M);
    expect(clampRadius(50_000)).toBe(MAX_RADIUS_M);
  });

  it('rounds to whole metres', () => {
    expect(clampRadius(1234.6)).toBe(1235);
  });

  it('falls back to the default for something that is not a number', () => {
    expect(clampRadius(Number.NaN)).toBe(DEFAULT_RADIUS_M);
    expect(clampRadius(Number.POSITIVE_INFINITY)).toBe(DEFAULT_RADIUS_M);
  });
});

describe('isValidLatLng', () => {
  it('accepts real coordinates and rejects the rest', () => {
    expect(isValidLatLng(51.1, 17.03)).toBe(true);
    expect(isValidLatLng(-90, 180)).toBe(true);
    expect(isValidLatLng(91, 17)).toBe(false);
    expect(isValidLatLng(51, -181)).toBe(false);
    expect(isValidLatLng(Number.NaN, 17)).toBe(false);
  });
});

describe('roundCoord', () => {
  it('rounds to the given number of decimals', () => {
    expect(roundCoord(51.107_949, 3)).toBe(51.108);
    expect(roundCoord(17.038_549, 4)).toBe(17.0385);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/lib/geo.spec.ts`
Expected: FAIL — `Failed to resolve import "./geo"`.

- [ ] **Step 3: Implement** — `src/lib/geo.ts`

```ts
// Distances on the ground, for the "near a point" filter. Pure functions — no
// Leaflet, no DOM — so the rule that decides what counts as "within 1 km" can
// be tested exactly.

/** A point, in WGS84 degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** The edges of a latitude/longitude rectangle, in degrees. */
export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

// Mean Earth radius (IUGG). Treating the Earth as a sphere is off by at most
// ~0.5% against the ellipsoid: under 25 m at the 5 km limit, far below what a
// walking-distance filter can notice.
const EARTH_RADIUS_M = 6_371_008.8;

/** The radius a proximity filter may take, in metres. */
export const MIN_RADIUS_M = 500;
export const MAX_RADIUS_M = 5000;
export const RADIUS_STEP_M = 500;
export const DEFAULT_RADIUS_M = 1000;

/**
 * How far from a city centre still counts as "in or around" the city: the area
 * address suggestions are confined to, and past which a chosen point is called
 * out as far away.
 */
export const CITY_AREA_RADIUS_M = 25_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance between two points, in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  // min(1, …) keeps a rounding error from pushing asin past its domain for
  // antipodal points.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The smallest latitude/longitude rectangle holding every point within
 * `radiusM` of `center` — a pre-filter cheap enough for plain column
 * comparisons in the database, with the exact circle applied afterwards.
 *
 * The east-west half-width depends on latitude because meridians converge
 * towards the poles: at 51°N a degree of longitude is ~70 km, not ~111 km. Not
 * meant for boxes spanning a pole or the antimeridian, which no Polish city
 * comes near.
 */
export function boundingBox(center: LatLng, radiusM: number): BoundingBox {
  const angular = radiusM / EARTH_RADIUS_M;
  const dLat = toDeg(angular);
  const dLng = toDeg(Math.asin(Math.min(1, Math.sin(angular) / Math.cos(toRad(center.lat)))));
  return {
    south: center.lat - dLat,
    west: center.lng - dLng,
    north: center.lat + dLat,
    east: center.lng + dLng,
  };
}

/** A radius the filter supports: whole metres, within the allowed range. */
export function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(value)));
}

/** True for a finite latitude/longitude pair inside the valid ranges. */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/** Round a coordinate to `decimals` places: 3 ≈ 110 m, 4 ≈ 11 m. */
export function roundCoord(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
```

- [ ] **Step 4: Reuse it for the nearest-city lookup** — in `src/config/cities.ts`, add `import { distanceMeters } from '@/lib/geo';` below `import { env } from './env';` and replace `findNearestAvailableCity` with:

```ts
// Nearest by great-circle distance — good enough for snapping to a city.
export function findNearestAvailableCity(lat: number, lng: number): CityConfig {
  const pool = AVAILABLE_CITIES.length > 0 ? AVAILABLE_CITIES : CITIES;
  let nearest = pool[0];
  let best = Infinity;
  for (const city of pool) {
    const distance = distanceMeters({ lat, lng }, city.coordinates);
    if (distance < best) {
      best = distance;
      nearest = city;
    }
  }
  return nearest;
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/lib/geo.spec.ts src/config/cities.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geo.ts src/lib/geo.spec.ts src/config/cities.ts
git commit -m "feat(geo): distances, bounding boxes and radius limits for proximity"
```

---

### Task 2: Distance formatting

**Files:**
- Modify: `src/lib/utils.ts` (imports at top; new functions after `formatEventTime`)
- Modify: `src/lib/utils.spec.ts`

- [ ] **Step 1: Write the failing test** — append to `src/lib/utils.spec.ts` (add `formatDistance, formatEventDistance` to its import from `./utils`, and `import type { Event } from '@/types/event.types';`)

```ts
describe('formatDistance', () => {
  it('says metres under a kilometre, rounded to tens', () => {
    expect(formatDistance(847)).toBe('850 m');
    expect(formatDistance(4)).toBe('0 m');
  });

  it('switches to kilometres with one decimal, in the interface language', () => {
    expect(formatDistance(1500, 'pl')).toBe('1,5 km');
    expect(formatDistance(1500, 'en')).toBe('1.5 km');
  });

  it('drops a trailing zero, so a whole radius reads "2 km"', () => {
    expect(formatDistance(2000)).toBe('2 km');
  });

  it('rounds 995 m up into kilometres rather than printing "1000 m"', () => {
    expect(formatDistance(995)).toBe('1 km');
  });
});

describe('formatEventDistance', () => {
  const at = (lat: number | null, lng: number | null) =>
    ({ location: { name: 'X', city: 'Wrocław', lat, lng } }) as Event;

  it('formats the distance from the origin to the venue', () => {
    expect(formatEventDistance(at(51.1176, 17.032), { lat: 51.11, lng: 17.032 })).toBe('850 m');
  });

  it('is undefined without an origin or without coordinates', () => {
    expect(formatEventDistance(at(51.11, 17.032), null)).toBeUndefined();
    expect(formatEventDistance(at(null, null), { lat: 51.11, lng: 17.032 })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/lib/utils.spec.ts`
Expected: FAIL — `formatDistance` is not exported.

- [ ] **Step 3: Implement** — in `src/lib/utils.ts` add imports at the top:

```ts
import type { Event } from '@/types/event.types';
import { distanceMeters, type LatLng } from './geo';
```

and after `formatEventTime`:

```ts
/**
 * A distance in the interface language: metres under a kilometre, rounded to
 * tens ("850 m" reads as walking distance; "0,85 km" makes you do sums), then
 * kilometres with at most one decimal ("1,5 km", "2 km"). Number and unit are
 * joined by a no-break space so a line never splits between them.
 */
export function formatDistance(meters: number, locale: string = 'pl'): string {
  const rounded = Math.round(meters / 10) * 10;
  if (rounded < 1000) return `${rounded} m`;
  const km = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(
    meters / 1000
  );
  return `${km} km`;
}

/** How far an event's venue is from `origin`, formatted — undefined when either end is unknown. */
export function formatEventDistance(
  event: Event,
  origin: LatLng | null | undefined,
  locale: string = 'pl'
): string | undefined {
  const { lat, lng } = event.location;
  if (!origin || lat === null || lng === null) return undefined;
  return formatDistance(distanceMeters(origin, { lat, lng }), locale);
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/lib/utils.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.spec.ts
git commit -m "feat(utils): format a distance in the interface language"
```

---

### Task 3: The URL contract

**Files:**
- Modify: `src/types/filter.types.ts`
- Modify: `src/lib/filterUtils.ts`, `src/lib/filterUtils.spec.ts`
- Modify: `src/components/service/queryKeys.ts`, `src/components/service/queryKeys.spec.ts`
- Modify: `src/components/service/eventsApi.spec.ts` (`makeFilters` gains `near: null`)
- Modify: `src/components/service/useFilterNavigation.ts` (doc comment of `clearFilters`)

- [ ] **Step 1: Types** — in `src/types/filter.types.ts` replace the `SortKey` line and add `NearFilter`:

```ts
/** How the list is ordered. `date` is the default: soonest first. `distance` needs a point to measure from. */
export type SortKey = 'date' | 'name' | 'venue' | 'price' | 'distance';
export type SortDir = 'asc' | 'desc';

/**
 * "Within `radius` metres of this point" — the point being wherever the visitor
 * said: their location, an address, or a pin dropped on a map.
 */
export interface NearFilter {
  lat: number;
  lng: number;
  /** Metres, MIN_RADIUS_M–MAX_RADIUS_M (lib/geo). */
  radius: number;
  /** What the point is called — an address. Null for a location fix or a map pick. */
  label: string | null;
}
```

and in `EventFilters`, after `freeOnly: boolean;`:

```ts
  // Only events within a radius of a point. Composes with every other filter.
  near: NearFilter | null;
```

- [ ] **Step 2: Write the failing tests** — append to `src/lib/filterUtils.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm vitest run src/lib/filterUtils.spec.ts`
Expected: FAIL — `near` is `undefined`; `sort=distance` falls back.

- [ ] **Step 4: Implement** — in `src/lib/filterUtils.ts`:

Imports:

```ts
import { DateMode, EventFilters, NearFilter, PageSize, SortDir, SortKey, ViewMode } from '@/types/filter.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from './constants';
import { clampRadius, isValidLatLng, roundCoord } from './geo';
import { parseWeekdays, serializeWeekdays } from './weekdays';
```

`VALID_SORTS` gains `'distance'`:

```ts
const VALID_SORTS = new Set<SortKey>(['date', 'name', 'venue', 'price', 'distance']);
```

After `parseDir`:

```ts
// A point is written with at most 4 decimals (~11 m): plenty against a radius
// that starts at 500 m, and short enough to keep a shared link readable.
const NEAR_DECIMALS = 4;
export const MAX_NEAR_LABEL_LENGTH = 100;

/**
 * The proximity filter from its three parameters, or null when `near` is not a
 * usable point — radius and label then mean nothing and are dropped, the way an
 * hour range is without a date. A missing or junk radius falls back to the
 * default; an out-of-range one is clamped rather than rejected.
 */
export function parseNear(
  near: string | null,
  radius: string | null,
  label: string | null
): NearFilter | null {
  if (!near) return null;
  const parts = near.split(',');
  if (parts.length !== 2 || parts.some((part) => part.trim() === '')) return null;
  const [lat, lng] = parts.map(Number);
  if (!isValidLatLng(lat, lng)) return null;
  return {
    lat: roundCoord(lat, NEAR_DECIMALS),
    lng: roundCoord(lng, NEAR_DECIMALS),
    radius: clampRadius(radius ? Number(radius) : Number.NaN),
    label: label?.trim().slice(0, MAX_NEAR_LABEL_LENGTH) || null,
  };
}

function serializeNear(near: NearFilter): string {
  return `${roundCoord(near.lat, NEAR_DECIMALS)},${roundCoord(near.lng, NEAR_DECIMALS)}`;
}
```

In `parseFiltersFromParams`, after `const dateMode = parseDateMode(searchParams);`:

```ts
  const near = parseNear(get('near'), get('radius'), get('nearLabel'));
  const sort = parseSort(get('sort'));
```

and in the returned object, after `freeOnly`, add `near,` and replace the `sort` line with:

```ts
    // Distance is measured from the point; with no point it reads as the default.
    sort: sort === 'distance' && !near ? DEFAULT_SORT : sort,
```

In `filtersToSearchParams`, after the `freeOnly` line:

```ts
  if (filters.near) {
    params.set('near', serializeNear(filters.near));
    // Written even at its default: a shared link should say what it means, not
    // depend on what the default happens to be when it is opened.
    params.set('radius', String(clampRadius(filters.near.radius)));
    setIfTruthy(params, 'nearLabel', filters.near.label);
  }
```

and replace the `sort` line with:

```ts
  // A distance ordering left behind by a removed point is only a stale parameter.
  const sort = filters.sort === 'distance' && !filters.near ? DEFAULT_SORT : filters.sort;
  if (sort && sort !== DEFAULT_SORT) params.set('sort', sort);
```

In `countActiveFilters`, after `freeOnly`: `if (filters.near) count++;`
In `getDefaultFilters`, after `freeOnly: false,`: `near: null,`

- [ ] **Step 5: Query keys — failing test** — append to `src/components/service/queryKeys.spec.ts`:

```ts
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
```

Run: `pnpm vitest run src/components/service/queryKeys.spec.ts` — Expected: FAIL on "separates".

- [ ] **Step 6: Implement** — in `src/components/service/queryKeys.ts`, import `NearFilter` alongside `EventFilters`, add above `queryShape`:

```ts
// The label names the point without moving it: two names for one point ask the
// same question, so only the geometry identifies the answer.
function nearShape(near: NearFilter | null): string | null {
  return near ? `${near.lat},${near.lng},${near.radius}` : null;
}
```

and in `queryShape`, after `freeOnly: filters.freeOnly,`: `near: nearShape(filters.near),`

- [ ] **Step 7: Keep the other specs compiling** — in `src/components/service/eventsApi.spec.ts` `makeFilters`, after `freeOnly: false,` add `near: null,`. In `src/components/service/useFilterNavigation.ts` change the `clearFilters` doc line to `Reset every filter (search, categories, date, hour, freeOnly, near, page) to its`.

- [ ] **Step 8: Run the tests**

Run: `pnpm vitest run src/lib/filterUtils.spec.ts src/components/service/queryKeys.spec.ts && pnpm type-check`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/types/filter.types.ts src/lib/filterUtils.ts src/lib/filterUtils.spec.ts src/components/service/queryKeys.ts src/components/service/queryKeys.spec.ts src/components/service/eventsApi.spec.ts src/components/service/useFilterNavigation.ts
git commit -m "feat(filters): put a point and a radius in the URL"
```

---

### Task 4: Querying by proximity

**Files:**
- Modify: `src/components/service/eventsApi.ts`
- Modify: `src/components/service/eventsApi.spec.ts`

- [ ] **Step 1: Extend the test double** — in `eventsApi.spec.ts` replace `setup()` with:

```ts
function setup() {
  const results = {
    events: { data: [], count: 0, error: null } as ListResult,
    // Answers for successive events queries, in order — a client-filtered list
    // makes two (the scan, then the page). Falls back to `events` once empty.
    eventsQueue: [] as ListResult[],
    single: { data: null, error: null } as SingleResult,
    categories: { data: [], count: null, error: null } as ListResult,
  };

  let eventsBuilder!: Builder;
  let categoriesBuilder!: Builder;
  const eventsBuilders: Builder[] = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'categories') {
        categoriesBuilder = makeBuilder(() => results.categories, () => ({ data: null, error: null }));
        return categoriesBuilder;
      }
      const queued = results.eventsQueue.shift();
      eventsBuilder = makeBuilder(() => queued ?? results.events, () => results.single);
      eventsBuilders.push(eventsBuilder);
      return eventsBuilder;
    }),
  };
  getSupabaseForCityMock.mockReturnValue(client as unknown as SupabaseClient);

  return {
    client,
    results,
    get eventsBuilder() {
      return eventsBuilder;
    },
    /** Every events query made, in order. */
    get eventsBuilders() {
      return eventsBuilders;
    },
    get categoriesBuilder() {
      return categoriesBuilder;
    },
  };
}
```

- [ ] **Step 2: Replace the free-only paging test** — in `describe('free-only (client-side) filtering')`, replace `it('does not push pagination to the db when free-only filtering', …)` with:

```ts
      // The database cannot page what the browser filters, so it is never asked
      // for the list page: it is scanned in its own fixed-size pages, and the
      // list page is cut from the ids the scan kept.
      it('scans in fixed-size pages rather than asking the db for the list page', async () => {
        const s = setup();
        s.results.events = { data: [makeRow({ is_free: true, price: null })], count: 1, error: null };

        await fetchEvents('szczecin', makeFilters({ freeOnly: true, page: 2 }));

        expect(s.eventsBuilders[0].range).toHaveBeenCalledWith(0, 999);
        expect(s.eventsBuilders[0].range).not.toHaveBeenCalledWith(15, 29);
      });
```

- [ ] **Step 3: Write the failing proximity tests** — add inside `describe('fetchEvents')`, before `it('throws ServerError when the query fails', …)`:

```ts
    describe('proximity', () => {
      // Wrocław's Rynek; 0.009° of latitude is ~1 km.
      const NEAR = { lat: 51.11, lng: 17.032, radius: 1000, label: null };
      const at = (id: number, dLat: number, dLng: number) =>
        makeRow({ id, lat: 51.11 + dLat, lng: 17.032 + dLng });

      it('narrows the database to the box around the circle', async () => {
        const s = setup();

        await fetchMapEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(s.eventsBuilder.gte).toHaveBeenCalledWith('lat', expect.closeTo(51.101, 3));
        expect(s.eventsBuilder.lte).toHaveBeenCalledWith('lat', expect.closeTo(51.119, 3));
        expect(s.eventsBuilder.gte).toHaveBeenCalledWith('lng', expect.closeTo(17.0177, 3));
        expect(s.eventsBuilder.lte).toHaveBeenCalledWith('lng', expect.closeTo(17.0463, 3));
      });

      it('keeps only the map rows inside the circle, not merely inside the box', async () => {
        const s = setup();
        // 945 m due north: inside. ~1093 m north-east: in the box's corner,
        // outside the circle.
        s.results.events = { data: [at(1, 0, 0), at(2, 0.0085, 0), at(3, 0.007, 0.011)], count: 3, error: null };

        const { events, total } = await fetchMapEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events.map((e) => e.id)).toEqual(['1', '2']);
        expect(total).toBe(2);
      });

      it('scans slim rows, then fetches only the requested page in full', async () => {
        const s = setup();
        const rows = Array.from({ length: 16 }, (_, i) => at(i + 1, i * 0.0001, 0));
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: [...rows].reverse(), count: null, error: null },
        ];

        const { events, total } = await fetchEvents('wroclaw', makeFilters({ near: NEAR, page: 2 }));

        const [scan, hydrate] = s.eventsBuilders;
        expect(scan.select).toHaveBeenCalledWith('id,lat,lng,is_free,price,price_label', undefined);
        expect(scan.range).toHaveBeenCalledWith(0, 999);
        expect(hydrate.in).toHaveBeenCalledWith('id', [16]);
        expect(hydrate.range).not.toHaveBeenCalled();
        expect(events.map((e) => e.id)).toEqual(['16']);
        expect(total).toBe(16);
      });

      it('returns the page in the order the scan found it, whatever order the rows arrive in', async () => {
        const s = setup();
        const rows = [at(1, 0, 0), at(2, 0.001, 0), at(3, 0.002, 0)];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: [rows[2], rows[0], rows[1]], count: null, error: null },
        ];

        const { events } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events.map((e) => e.id)).toEqual(['1', '2', '3']);
      });

      it('keeps scanning while pages come back full', async () => {
        const s = setup();
        s.results.eventsQueue = [
          { data: Array.from({ length: 1000 }, (_, i) => at(i + 1, 0, 0)), count: null, error: null },
          { data: [at(1001, 0, 0)], count: null, error: null },
          { data: [], count: null, error: null },
        ];

        const { total } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(total).toBe(1001);
        expect(s.eventsBuilders[0].range).toHaveBeenCalledWith(0, 999);
        expect(s.eventsBuilders[1].range).toHaveBeenCalledWith(1000, 1999);
      });

      // Rows sharing a date and a start time could otherwise trade places
      // between two pages of the scan and be counted twice, or not at all.
      it('breaks ordering ties by id so the scan pages are stable', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: [], count: null, error: null }];

        await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(s.eventsBuilders[0].order).toHaveBeenLastCalledWith('id', { ascending: true });
      });

      it('skips the page request when the page is empty', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: [at(1, 0.007, 0.011)], count: null, error: null }];

        const { events, total } = await fetchEvents('wroclaw', makeFilters({ near: NEAR }));

        expect(events).toEqual([]);
        expect(total).toBe(0);
        expect(s.eventsBuilders).toHaveLength(1);
      });

      it('orders by distance in the scan, nearest first', async () => {
        const s = setup();
        // The database's (date) order: far, near, middle.
        const rows = [at(1, 0.006, 0), at(2, 0.001, 0), at(3, 0.003, 0)];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: rows, count: null, error: null },
        ];

        const { events } = await fetchEvents('wroclaw', makeFilters({ near: NEAR, sort: 'distance' }));

        expect(events.map((e) => e.id)).toEqual(['2', '3', '1']);
      });

      it('orders by distance farthest first for dir: desc, ties keeping date order', async () => {
        const s = setup();
        const rows = [at(1, 0.001, 0), at(2, 0.006, 0), at(3, 0.001, 0)];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: rows, count: null, error: null },
        ];

        const { events } = await fetchEvents(
          'wroclaw',
          makeFilters({ near: NEAR, sort: 'distance', dir: 'desc' })
        );

        expect(events.map((e) => e.id)).toEqual(['2', '1', '3']);
      });

      it('asks the database for ascending date order under a distance sort, either direction', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: [], count: null, error: null }];

        await fetchEvents('wroclaw', makeFilters({ near: NEAR, sort: 'distance', dir: 'desc' }));

        const scan = s.eventsBuilders[0];
        expect(scan.order).toHaveBeenNthCalledWith(1, 'date', { ascending: true });
        expect(scan.order).toHaveBeenNthCalledWith(2, 'time_start', { ascending: true });
      });

      it('applies free-only and the circle together', async () => {
        const s = setup();
        const rows = [
          makeRow({ id: 1, lat: 51.11, lng: 17.032, is_free: true, price: null, price_label: '' }),
          makeRow({ id: 2, lat: 51.11, lng: 17.032, is_free: false, price: 50, price_label: '50 zł' }),
          makeRow({ id: 3, lat: 51.13, lng: 17.032, is_free: true, price: null, price_label: '' }),
        ];
        s.results.eventsQueue = [
          { data: rows, count: null, error: null },
          { data: rows, count: null, error: null },
        ];

        const { events, total } = await fetchEvents(
          'wroclaw',
          makeFilters({ near: NEAR, freeOnly: true })
        );

        expect(events.map((e) => e.id)).toEqual(['1']);
        expect(total).toBe(1);
      });

      it('throws ServerError when the scan fails', async () => {
        const s = setup();
        s.results.eventsQueue = [{ data: null, count: null, error: { message: 'boom' } }];

        await expect(fetchEvents('wroclaw', makeFilters({ near: NEAR }))).rejects.toBeInstanceOf(
          ServerError
        );
      });
    });
```

- [ ] **Step 4: Run them to see them fail**

Run: `pnpm vitest run src/components/service/eventsApi.spec.ts`
Expected: FAIL — no `lat`/`lng` comparisons, no scan.

- [ ] **Step 5: Implement** — in `src/components/service/eventsApi.ts`:

Add `import { boundingBox, distanceMeters } from '@/lib/geo';`.

Below the `SupabaseEventRow` interface:

```ts
// The columns the client-side filters read (see matchesClientFilters) — all a
// scan has to fetch.
type ClientFilterRow = Pick<SupabaseEventRow, 'id' | 'lat' | 'lng' | 'is_free' | 'price' | 'price_label'>;
const CLIENT_FILTER_COLUMNS = 'id,lat,lng,is_free,price,price_label';
```

Narrow `parsePriceAmount`'s parameter:

```ts
function parsePriceAmount(row: Pick<SupabaseEventRow, 'is_free' | 'price' | 'price_label'>): number | null {
```

Give `buildFilteredQuery` a column list and an optional count (replace its signature and first line):

```ts
interface QueryShape {
  /** PostgREST `select` list. */
  columns?: string;
  /** Ask for an exact count alongside the rows. */
  withCount?: boolean;
}

function buildFilteredQuery(
  supabase: ReturnType<typeof getSupabaseForCity>,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter,
  { columns = '*', withCount = true }: QueryShape = {}
) {
  let query = supabase.from('events').select(columns, withCount ? { count: 'exact' } : undefined);
```

and add the box clause just before `return applyOrder(query, filters);`:

```ts
  // Proximity, first pass: the box around the circle, as four comparisons on
  // plain columns — no extension, no index, and it works against every schema
  // as it stands. The exact circle is the browser's job (matchesClientFilters);
  // the box only has to contain it. Rows with no coordinates fail the
  // comparisons and drop out here.
  if (filters.near) {
    const box = boundingBox(filters.near, filters.near.radius);
    query = query
      .gte('lat', box.south)
      .lte('lat', box.north)
      .gte('lng', box.west)
      .lte('lng', box.east);
  }
```

In `applyOrder`, add before `case 'date':`

```ts
    case 'distance':
      // The database cannot measure distance; the scan sorts by it afterwards
      // (scanMatchingIds). What it can do is hand over the ties — one venue,
      // many events — already in the order they should keep: soonest first,
      // whichever way the distance runs.
      return builder
        .order('date', { ascending: true })
        .order('time_start', { ascending: true }) as T;
```

Replace `fetchEvents`, `fetchMapEvents`'s body and `applyClientFilters` with:

```ts
// The filters with no column to compare against: free entry is derived from
// three price columns, and a circle is not a range. Both run on raw rows, so a
// scan can apply them to its six columns without building whole events.
function hasClientFilters(filters: EventFilters): boolean {
  return filters.freeOnly || filters.near !== null;
}

function matchesClientFilters(row: ClientFilterRow, filters: EventFilters): boolean {
  if (filters.freeOnly) {
    const amount = parsePriceAmount(row);
    if (amount !== 0 && amount !== null) return false;
  }
  if (filters.near) {
    if (row.lat === null || row.lng === null) return false;
    if (distanceMeters(filters.near, { lat: row.lat, lng: row.lng }) > filters.near.radius) {
      return false;
    }
  }
  return true;
}

// PostgREST ends a response at 1000 rows whatever was asked for, so a scan
// requests exactly that much per page and keeps going while pages come back
// full. The page cap is a runaway guard, not a product limit: 20 pages is 20k
// matching events in one city.
const SCAN_PAGE_SIZE = 1000;
const SCAN_MAX_PAGES = 20;

/**
 * The ids of every event passing the client filters, in list order.
 *
 * Only the columns those filters read are fetched — ~95 bytes a row against
 * ~2.4 KB for a whole one (measured on Wrocław's 5 km box: 7 KB gzipped
 * against 505 KB) — so the total and the page boundaries are found without
 * downloading every match in full.
 */
async function scanMatchingIds(
  supabase: ReturnType<typeof getSupabaseForCity>,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter
): Promise<number[]> {
  const matches: ClientFilterRow[] = [];
  for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
    const from = page * SCAN_PAGE_SIZE;
    // `id` breaks ties, so rows sharing a date and time cannot trade places
    // between two pages of the scan and be counted twice or not at all.
    const { data, error } = await buildFilteredQuery(supabase, filters, categoryFilter, {
      columns: CLIENT_FILTER_COLUMNS,
      withCount: false,
    })
      .order('id', { ascending: true })
      .range(from, from + SCAN_PAGE_SIZE - 1);
    if (error) throw new ServerError(error.message);

    const batch = (data as ClientFilterRow[] | null) ?? [];
    for (const row of batch) {
      if (matchesClientFilters(row, filters)) matches.push(row);
    }
    if (batch.length < SCAN_PAGE_SIZE) break;
  }

  const near = filters.near;
  if (filters.sort === 'distance' && near) {
    const sign = filters.dir === 'desc' ? -1 : 1;
    // Every match has coordinates: the circle let none through without them.
    const distance = new Map(
      matches.map((row) => [
        row.id,
        distanceMeters(near, { lat: row.lat as number, lng: row.lng as number }),
      ])
    );
    // Array#sort is stable, so equal distances keep the database's date order.
    matches.sort((a, b) => sign * ((distance.get(a.id) ?? 0) - (distance.get(b.id) ?? 0)));
  }
  return matches.map((row) => row.id);
}

/** Whole rows for `ids`, in the order given — `in` answers in whatever order it likes. */
async function fetchRowsInOrder(
  supabase: ReturnType<typeof getSupabaseForCity>,
  ids: number[],
  cityName: string
): Promise<Event[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('events').select('*').in('id', ids);
  if (error) throw new ServerError(error.message);
  const byId = new Map(((data as SupabaseEventRow[] | null) ?? []).map((row) => [row.id, row]));
  // An id whose row vanished between the scan and now (a scraper run) is
  // skipped; the page is one short until the next refetch.
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [mapRow(row, cityName)] : [];
  });
}

export async function fetchEvents(
  cityId: CityId | string,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter = EMPTY_CATEGORY_FILTER
): Promise<{ events: Event[]; total: number }> {
  const city = getCity(cityId);
  const supabase = getSupabaseForCity(city.id);
  const cityName = city.displayName.pl;
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  // A filter the database cannot evaluate also defeats its count and its
  // paging, so such a list is found in two steps: every matching id (the
  // scan), then whole rows for this page only.
  if (hasClientFilters(filters)) {
    const ids = await scanMatchingIds(supabase, filters, categoryFilter);
    const events = await fetchRowsInOrder(supabase, ids.slice(from, to + 1), cityName);
    return { events, total: ids.length };
  }

  const { data, count, error } = await buildFilteredQuery(supabase, filters, categoryFilter).range(
    from,
    to
  );
  if (error) throw new ServerError(error.message);

  const events = ((data as SupabaseEventRow[] | null) ?? []).map((row) => mapRow(row, cityName));
  return { events, total: count ?? 0 };
}
```

`fetchMapEvents` keeps its doc comment; its body after the query becomes:

```ts
  const { data, count, error } = await buildFilteredQuery(supabase, filters, categoryFilter)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(MAP_EVENT_LIMIT);
  if (error) throw new ServerError(error.message);

  const cityName = city.displayName.pl;
  const rows = (data as SupabaseEventRow[] | null) ?? [];

  // The filters with no column behind them (free entry, the circle) run here,
  // as in fetchEvents — so the database's count is no longer the count of what
  // is shown, and is recomputed.
  if (hasClientFilters(filters)) {
    const events = rows
      .filter((row) => matchesClientFilters(row, filters))
      .map((row) => mapRow(row, cityName));
    return { events, total: events.length };
  }

  const events = rows.map((row) => mapRow(row, cityName));
  return { events, total: count ?? events.length };
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run src/components/service/eventsApi.spec.ts && pnpm type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/service/eventsApi.ts src/components/service/eventsApi.spec.ts
git commit -m "feat(events): filter by distance — a box in the database, the circle in the browser

A client-filtered list (the circle, or freeOnly) is now scanned as slim rows
and hydrated one page at a time, instead of downloading every match in full;
freeOnly also stops being cut off silently at 1000 rows."
```

---

### Task 5: Strings

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: Add to `pl`** — after `FILTER_COLLAPSE: 'Zwiń',`:

```ts
  FILTER_NEAR: 'W pobliżu',
  NEAR_USE_MY_LOCATION: 'Użyj mojej lokalizacji',
  NEAR_LOCATING: 'Ustalam lokalizację…',
  NEAR_ADDRESS_LABEL: 'Adres lub miejsce',
  NEAR_ADDRESS_PLACEHOLDER: 'np. ulica i numer',
  NEAR_ADDRESS_MIN_CHARS: 'Wpisz co najmniej 3 znaki',
  NEAR_ADDRESS_LOADING: 'Szukam…',
  NEAR_ADDRESS_NO_RESULTS: 'Nie znaleziono takiego adresu',
  NEAR_ADDRESS_ERROR: 'Wyszukiwarka adresów jest chwilowo niedostępna',
  NEAR_ADDRESS_CREDIT: 'Adresy: Photon (komoot), dane © OpenStreetMap',
  NEAR_PICK_ON_MAP: 'Wskaż na mapie',
  NEAR_PICKER_TITLE: 'Wskaż punkt na mapie',
  NEAR_PICKER_HINT: 'Kliknij mapę, aby postawić pinezkę, i przeciągnij ją, aby ją przesunąć.',
  NEAR_PICKER_USE_CENTER: 'Postaw na środku mapy',
  NEAR_PICKER_CONFIRM: 'Zastosuj',
  NEAR_PICKER_CANCEL: 'Anuluj',
  NEAR_RADIUS: 'Promień',
  NEAR_MY_LOCATION: 'Twoja lokalizacja',
  NEAR_PICKED_POINT: 'Wybrany punkt',
  NEAR_REMOVE: 'Usuń lokalizację',
  NEAR_CHIP: (radius: string, place: string) => `W promieniu ${radius}: ${place}`,
  NEAR_FAR_FROM_CITY: 'Ten punkt leży daleko od wybranego miasta, więc wyników może nie być.',
  NEAR_ERROR_DENIED:
    'Brak zgody na dostęp do lokalizacji. Zezwól na nią w ustawieniach przeglądarki albo wpisz adres.',
  NEAR_ERROR_UNAVAILABLE:
    'Nie udało się ustalić Twojej lokalizacji. Wpisz adres albo wskaż punkt na mapie.',
  NEAR_ERROR_TIMEOUT: 'Ustalanie lokalizacji trwało zbyt długo. Spróbuj ponownie albo wpisz adres.',
  NEAR_ERROR_UNSUPPORTED:
    'Ta przeglądarka nie udostępnia lokalizacji. Wpisz adres albo wskaż punkt na mapie.',
  EVENT_DISTANCE: (distance: string) => `${distance} od wybranego punktu`,
```

after `SORT_PRICE: 'Cena',`: `SORT_DISTANCE: 'Odległość',`

after `PRIVACY_WHAT_BODY: …,`:

```ts
  PRIVACY_LOCATION_HEADING: 'Lokalizacja',
  PRIVACY_LOCATION_BODY:
    'Twoją lokalizację pobieramy tylko wtedy, gdy klikniesz „Użyj mojej lokalizacji”, i od razu zaokrąglamy ją do ok. 100 m. Trafia wyłącznie do adresu strony — żeby filtr działał i dało się go udostępnić — oraz, jako obszar wyszukiwania, do zapytania o wydarzenia; nigdzie jej nie zapisujemy. Gdy Clarity ma Twoją zgodę, adres strony, a z nim zaokrąglona lokalizacja, trafia też do nagrania sesji. Adres wpisany w wyszukiwarkę wysyłamy do usługi Photon (komoot), która zamienia go na współrzędne.',
```

and replace `PRIVACY_PROCESSOR_BODY` with:

```ts
  PRIVACY_PROCESSOR_BODY:
    'Microsoft, jako dostawca usługi Clarity. Komoot GmbH, jako dostawca wyszukiwarki adresów Photon — tylko gdy wyszukujesz adres.',
```

- [ ] **Step 2: Add to `en`** — at the matching positions:

```ts
  FILTER_NEAR: 'Nearby',
  NEAR_USE_MY_LOCATION: 'Use my location',
  NEAR_LOCATING: 'Finding your location…',
  NEAR_ADDRESS_LABEL: 'Address or place',
  NEAR_ADDRESS_PLACEHOLDER: 'e.g. street and number',
  NEAR_ADDRESS_MIN_CHARS: 'Type at least 3 characters',
  NEAR_ADDRESS_LOADING: 'Searching…',
  NEAR_ADDRESS_NO_RESULTS: 'No such address found',
  NEAR_ADDRESS_ERROR: 'Address search is unavailable right now',
  NEAR_ADDRESS_CREDIT: 'Addresses: Photon (komoot), data © OpenStreetMap',
  NEAR_PICK_ON_MAP: 'Pick on the map',
  NEAR_PICKER_TITLE: 'Pick a point on the map',
  NEAR_PICKER_HINT: 'Click the map to drop a pin, and drag the pin to move it.',
  NEAR_PICKER_USE_CENTER: 'Drop it at the map centre',
  NEAR_PICKER_CONFIRM: 'Apply',
  NEAR_PICKER_CANCEL: 'Cancel',
  NEAR_RADIUS: 'Radius',
  NEAR_MY_LOCATION: 'Your location',
  NEAR_PICKED_POINT: 'Selected point',
  NEAR_REMOVE: 'Remove location',
  NEAR_CHIP: (radius: string, place: string) => `Within ${radius}: ${place}`,
  NEAR_FAR_FROM_CITY: 'This point is far from the selected city, so there may be no results.',
  NEAR_ERROR_DENIED:
    'Location access was denied. Allow it in your browser settings, or type an address.',
  NEAR_ERROR_UNAVAILABLE:
    'Your location could not be found. Type an address or pick a point on the map.',
  NEAR_ERROR_TIMEOUT: 'Finding your location took too long. Try again, or type an address.',
  NEAR_ERROR_UNSUPPORTED:
    'This browser does not share its location. Type an address or pick a point on the map.',
  EVENT_DISTANCE: (distance: string) => `${distance} from the selected point`,
```

```ts
  SORT_DISTANCE: 'Distance',
```

```ts
  PRIVACY_LOCATION_HEADING: 'Location',
  PRIVACY_LOCATION_BODY:
    'We get your location only when you click "Use my location", and round it to about 100 m straight away. It goes only into the page address — so the filter works and can be shared — and, as a search area, into the query for events; we do not store it anywhere. When Clarity has your consent, the page address, and the rounded location with it, is also part of the session recording. An address you type into the search box is sent to the Photon service (komoot), which turns it into coordinates.',
  PRIVACY_PROCESSOR_BODY:
    'Microsoft, as the provider of Clarity. Komoot GmbH, as the provider of the Photon address search — only when you search for an address.',
```

- [ ] **Step 3: Check**

Run: `pnpm type-check && pnpm vitest run src/components/views/PrivacyView`
Expected: PASS (`en: Messages` fails type-check on any key missing from one side).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(i18n): strings for the nearby filter"
```

---

### Task 6: Address search (Photon)

**Files:**
- Create: `src/components/service/geocoding.ts`, `src/components/service/geocoding.spec.ts`
- Create: `src/components/service/useAddressSearch.ts`

- [ ] **Step 1: Write the failing test** — `src/components/service/geocoding.spec.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodingError, PHOTON_URL, photonUrl, searchAddresses, toSuggestion } from './geocoding';

const WROCLAW = { lat: 51.1079, lng: 17.0385 };

function feature(properties: Record<string, unknown>, coordinates: unknown = [17.0322, 51.1069]) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates }, properties };
}

const answer = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('photonUrl', () => {
  it('asks Photon for a few street-level results around the city', () => {
    const url = new URL(photonUrl('Świdnicka 12', WROCLAW, 'pl'));
    expect(`${url.origin}${url.pathname}`).toBe(PHOTON_URL);
    expect(url.searchParams.get('q')).toBe('Świdnicka 12');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('lat')).toBe('51.1079');
    expect(url.searchParams.get('lon')).toBe('17.0385');
    expect(url.searchParams.getAll('layer')).toEqual(['house', 'street', 'locality', 'district', 'other']);
  });

  it('confines results to a box around the city, ordered west, south, east, north', () => {
    const [west, south, east, north] = new URL(photonUrl('x', WROCLAW, 'pl')).searchParams
      .get('bbox')!
      .split(',')
      .map(Number);
    expect(west).toBeLessThan(WROCLAW.lng);
    expect(east).toBeGreaterThan(WROCLAW.lng);
    expect(south).toBeLessThan(WROCLAW.lat);
    // 25 km is ~0.225° of latitude.
    expect(north - WROCLAW.lat).toBeCloseTo(0.225, 2);
  });

  it('maps the interface language onto the ones Photon speaks', () => {
    expect(new URL(photonUrl('x', WROCLAW, 'pl')).searchParams.get('lang')).toBe('default');
    expect(new URL(photonUrl('x', WROCLAW, 'en')).searchParams.get('lang')).toBe('en');
  });
});

describe('toSuggestion', () => {
  it('names a bare building by its address', () => {
    expect(
      toSuggestion(
        feature({
          osm_type: 'W',
          osm_id: 7,
          street: 'Świdnicka',
          housenumber: '12-16',
          district: 'Stare Miasto',
          city: 'Wrocław',
        })
      )
    ).toEqual({
      id: 'W7',
      label: 'Świdnicka 12-16',
      detail: 'Stare Miasto, Wrocław',
      lat: 51.1069,
      lng: 17.0322,
    });
  });

  it("leads with a place's name and keeps its address beside it", () => {
    expect(toSuggestion(feature({ name: 'Pixel XL', street: 'Świdnicka', housenumber: '12' }))?.label).toBe(
      'Pixel XL, Świdnicka 12'
    );
  });

  it('names a street by its name alone', () => {
    expect(toSuggestion(feature({ name: 'Rynek', city: 'Wrocław' }))).toMatchObject({
      label: 'Rynek',
      detail: 'Wrocław',
    });
  });

  it('falls back to the locality, and does not repeat a district that is the city', () => {
    expect(toSuggestion(feature({ name: 'X', locality: 'Nadodrze', city: 'Wrocław' }))?.detail).toBe(
      'Nadodrze, Wrocław'
    );
    expect(toSuggestion(feature({ name: 'X', district: 'Opole', city: 'Opole' }))?.detail).toBe('Opole');
  });

  it('drops a feature with no name, no address or no usable point', () => {
    expect(toSuggestion(feature({ city: 'Wrocław' }))).toBeNull();
    expect(toSuggestion(feature({ name: 'X' }, [17.03]))).toBeNull();
    expect(toSuggestion(feature({ name: 'X' }, ['a', 'b']))).toBeNull();
    expect(toSuggestion(feature({ name: 'X' }, [200, 51]))).toBeNull();
  });
});

describe('searchAddresses', () => {
  it('returns suggestions, without the duplicates OSM produces', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      answer({
        features: [
          feature({ osm_type: 'N', osm_id: 1, name: 'Rynek', city: 'Wrocław' }),
          feature({ osm_type: 'W', osm_id: 2, name: 'Rynek', city: 'Wrocław' }),
          feature({ osm_type: 'W', osm_id: 3, street: 'Świdnicka', housenumber: '12', city: 'Wrocław' }),
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const suggestions = await searchAddresses('rynek', WROCLAW, 'pl');

    expect(suggestions.map((s) => s.label)).toEqual(['Rynek', 'Świdnicka 12']);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=rynek'), { signal: undefined });
  });

  it('passes the abort signal through, so a superseded search is cancelled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer({ features: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await searchAddresses('rynek', WROCLAW, 'pl', controller.signal);

    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it('throws GeocodingError when Photon fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer('nope', 503)));

    await expect(searchAddresses('rynek', WROCLAW, 'pl')).rejects.toBeInstanceOf(GeocodingError);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/components/service/geocoding.spec.ts`
Expected: FAIL — cannot resolve `./geocoding`.

- [ ] **Step 3: Implement** — `src/components/service/geocoding.ts`

```ts
import { boundingBox, CITY_AREA_RADIUS_M, isValidLatLng, type LatLng } from '@/lib/geo';
import type { Locale } from '@/i18n';

// Photon — komoot's geocoder over OpenStreetMap data. Chosen over Nominatim
// because it is built for search-as-you-type, which Nominatim's usage policy
// forbids from a browser. Fair use, no key: callers debounce, cache and cancel
// (see useAddressSearch). Its data is OpenStreetMap's (ODbL), credited under
// the search box.
export const PHOTON_URL = 'https://photon.komoot.io/api/';

const SUGGESTION_LIMIT = 5;

// Photon speaks default/de/en/fr. `default` is each place's own name — Polish,
// for Polish places — which is what a Polish interface wants anyway.
const PHOTON_LANG: Record<Locale, string> = { pl: 'default', en: 'en' };

// Street level and finer. A city, county or country would put the point in the
// middle of an area, which is nowhere in particular.
const LAYERS = ['house', 'street', 'locality', 'district', 'other'] as const;

export interface AddressSuggestion {
  /** OSM type + id: stable across searches, so usable as a React key. */
  id: string;
  /** What the point is called: "Świdnicka 12", "Pixel XL, Świdnicka 12", "Rynek". */
  label: string;
  /** Where it is, for telling look-alikes apart: "Stare Miasto, Wrocław". */
  detail: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
  };
}

export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodingError';
  }
}

/** The request for `query`: confined to the area around `center`, and biased towards it. */
export function photonUrl(query: string, center: LatLng, locale: Locale): string {
  const box = boundingBox(center, CITY_AREA_RADIUS_M);
  const params = new URLSearchParams({
    q: query,
    limit: String(SUGGESTION_LIMIT),
    lang: PHOTON_LANG[locale] ?? 'default',
    lat: String(center.lat),
    lon: String(center.lng),
    // minLon,minLat,maxLon,maxLat
    bbox: [box.west, box.south, box.east, box.north].map((v) => v.toFixed(4)).join(','),
  });
  for (const layer of LAYERS) params.append('layer', layer);
  return `${PHOTON_URL}?${params.toString()}`;
}

/** One Photon feature as a suggestion, or null when it has no usable point or name. */
export function toSuggestion(feature: PhotonFeature): AddressSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  // GeoJSON order: longitude first.
  const [lng, lat] = coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidLatLng(lat, lng)) return null;

  const p = feature.properties ?? {};
  const address = [p.street, p.housenumber].filter(Boolean).join(' ');
  // A named place leads with its name and keeps its address beside it; a bare
  // building is its address; a street is just its name.
  let label = address;
  if (p.name) label = address && address !== p.name ? `${p.name}, ${address}` : p.name;
  if (!label) return null;

  const detail = Array.from(new Set([p.district ?? p.locality, p.city].filter(Boolean))).join(', ');

  return {
    id: p.osm_type && p.osm_id !== undefined ? `${p.osm_type}${p.osm_id}` : `${lat},${lng}`,
    label,
    detail,
    lat,
    lng,
  };
}

/** Address suggestions for `query` around `center`. Throws GeocodingError on a failed response. */
export async function searchAddresses(
  query: string,
  center: LatLng,
  locale: Locale,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const response = await fetch(photonUrl(query, center, locale), { signal });
  if (!response.ok) throw new GeocodingError(`Photon answered ${response.status}`);
  const body = (await response.json()) as { features?: PhotonFeature[] };

  // OpenStreetMap often maps one place twice (a node and a building outline),
  // and Photon returns both under one name.
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const feature of body.features ?? []) {
    const suggestion = toSuggestion(feature);
    if (!suggestion) continue;
    const key = `${suggestion.label}|${suggestion.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
  }
  return suggestions;
}
```

- [ ] **Step 4: The hook** — `src/components/service/useAddressSearch.ts` (exercised through `AddressSearch`'s tests in Task 11)

```ts
'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCity } from '@/config/CityProvider';
import { useTranslation } from '@/i18n';
import { searchAddresses } from './geocoding';

/** Fewer characters than this match half a city — nothing is sent. */
export const ADDRESS_MIN_CHARS = 3;
// Long enough that a mid-word pause sends nothing, short enough to feel live.
const DEBOUNCE_MS = 400;

/**
 * Address suggestions for what is being typed, near the current city.
 *
 * Photon is a free service on fair use, so this is deliberately frugal:
 * nothing under three characters, nothing until typing pauses, a cached answer
 * for a repeated query, and a cancelled request for one already typed past
 * (React Query passes its AbortSignal through).
 */
export function useAddressSearch(input: string) {
  const { city } = useCity();
  const { locale } = useTranslation();
  const typed = input.trim();
  const [query, setQuery] = useState(typed);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const enabled = query.length >= ADDRESS_MIN_CHARS;
  const { data, isFetching, isError } = useQuery({
    queryKey: ['geocode', city.id, locale, query],
    queryFn: ({ signal }) => searchAddresses(query, city.coordinates, locale, signal),
    enabled,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const tooShort = typed.length < ADDRESS_MIN_CHARS;
  return {
    suggestions: !tooShort && enabled ? (data ?? []) : [],
    // Also true while the debounce has not caught up with the typing, so the
    // dropdown says "searching" instead of flashing "no results".
    isSearching: !tooShort && (query !== typed || isFetching),
    isError: enabled && isError,
    tooShort,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/components/service/geocoding.spec.ts && pnpm type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/service/geocoding.ts src/components/service/geocoding.spec.ts src/components/service/useAddressSearch.ts
git commit -m "feat(geocoding): address suggestions from Photon, confined to the city"
```

---

### Task 7: The device's location

**Files:**
- Create: `src/components/service/useGeolocation.ts`
- Create: `src/components/common/NearbyFilter/nearPlaceName.ts`

(Both are exercised by `NearbyFilter.spec.tsx` in Task 11 and `EventsListView.spec.tsx` in Task 13.)

- [ ] **Step 1: Implement** — `src/components/service/useGeolocation.ts`

```ts
'use client';

import { useCallback, useState } from 'react';
import { roundCoord, type LatLng } from '@/lib/geo';

export type GeolocationErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

// ~110 m. A fix ends up in the address bar — shareable, and part of the page
// address Clarity records when consented — so it is coarsened before it goes
// anywhere: enough to keep a home from being pinpointed, and nothing a radius
// of 500 m and up can notice.
const FIX_DECIMALS = 3;

const LAST_FIX_KEY = 'go-to-city.last-fix';

const POSITION_OPTIONS: PositionOptions = {
  // A cell-tower position can be kilometres out — no use against a 500 m radius.
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 60_000,
};

// GeolocationPositionError codes. The named constants live on the error
// instance, which a test double has no reason to carry.
function errorKind(code: number): GeolocationErrorKind {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

function fixKey(point: LatLng): string {
  return `${point.lat},${point.lng}`;
}

/**
 * Whether `point` is the position this tab last got from the device — what
 * lets an unlabelled point be called "your location". A point that arrived any
 * other way (a map pick, someone else's shared link) never matches.
 */
export function isOwnFix(point: LatLng): boolean {
  try {
    return window.sessionStorage.getItem(LAST_FIX_KEY) === fixKey(point);
  } catch {
    return false;
  }
}

/**
 * The device's position, on request. Never asked for on load: a permission
 * prompt nobody asked for is the fastest way to a permanent "block".
 */
export function useGeolocation() {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<GeolocationErrorKind | null>(null);

  const locate = useCallback((): Promise<LatLng | null> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('unsupported');
      return Promise.resolve(null);
    }
    setIsLocating(true);
    setError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = {
            lat: roundCoord(position.coords.latitude, FIX_DECIMALS),
            lng: roundCoord(position.coords.longitude, FIX_DECIMALS),
          };
          try {
            window.sessionStorage.setItem(LAST_FIX_KEY, fixKey(point));
          } catch {
            // Storage blocked: the point still works, it is just called
            // "selected point" instead of "your location".
          }
          setIsLocating(false);
          resolve(point);
        },
        (failure) => {
          setIsLocating(false);
          setError(errorKind(failure.code));
          resolve(null);
        },
        POSITION_OPTIONS
      );
    });
  }, []);

  return { locate, isLocating, error };
}
```

- [ ] **Step 2: Implement** — `src/components/common/NearbyFilter/nearPlaceName.ts`

```ts
import type { Messages } from '@/i18n';
import { isOwnFix } from '@/components/service/useGeolocation';
import type { NearFilter } from '@/types/filter.types';

/**
 * What to call a proximity filter's point: its address when it has one; "your
 * location" when it is this tab's own fix; otherwise "selected point" — which
 * is what someone else's location, arriving by a shared link, must be called.
 */
export function nearPlaceName(near: NearFilter, t: Messages): string {
  if (near.label) return near.label;
  return isOwnFix(near) ? t.NEAR_MY_LOCATION : t.NEAR_PICKED_POINT;
}
```

- [ ] **Step 3: Check and commit**

Run: `pnpm type-check && pnpm lint`
Expected: clean.

```bash
git add src/components/service/useGeolocation.ts src/components/common/NearbyFilter/nearPlaceName.ts
git commit -m "feat(location): the device's position on request, coarsened to ~100 m"
```

---

### Task 8: The circle on the events map

**Files:**
- Modify: `src/components/common/EventsMap/markerVisuals.tsx`, `markerVisuals.spec.tsx`
- Modify: `src/components/common/EventsMap/EventsMapInner.tsx`, `EventsMap.tsx`, `EventsMap.module.scss`

- [ ] **Step 1: Failing test** — append to `markerVisuals.spec.tsx` (add `originMarkup` to its import):

```ts
describe('originMarkup', () => {
  // The point a radius is measured from must never be mistaken for an event.
  it('is a ringed dot, not a teardrop pin', () => {
    const markup = originMarkup();
    expect(markup).toContain('<circle');
    expect(markup).not.toContain('<path');
  });
});
```

Run: `pnpm vitest run src/components/common/EventsMap/markerVisuals.spec.tsx` — Expected: FAIL.

- [ ] **Step 2: Implement** — append to `markerVisuals.tsx`:

```ts
// The point a proximity filter measures from: a ringed dot rather than a
// teardrop, so it can never be read as an event.
const ORIGIN_DIAMETER = 26;

export function originMarkup(): string {
  const r = ORIGIN_DIAMETER / 2;
  return [
    `<svg width="${ORIGIN_DIAMETER}" height="${ORIGIN_DIAMETER}" viewBox="0 0 ${ORIGIN_DIAMETER} ${ORIGIN_DIAMETER}"`,
    ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
    `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="${FALLBACK_COLOR}" stroke="#ffffff" stroke-width="3"/>`,
    `<circle cx="${r}" cy="${r}" r="3.5" fill="#ffffff"/>`,
    '</svg>',
  ].join('');
}

export const ORIGIN_SIZE: [number, number] = [ORIGIN_DIAMETER, ORIGIN_DIAMETER];
export const ORIGIN_ANCHOR: [number, number] = [ORIGIN_DIAMETER / 2, ORIGIN_DIAMETER / 2];

/** Leaflet path options for a proximity filter's circle. */
export const AREA_PATH_OPTIONS = {
  color: FALLBACK_COLOR,
  weight: 2,
  opacity: 0.9,
  fillColor: FALLBACK_COLOR,
  fillOpacity: 0.08,
} as const;
```

- [ ] **Step 3: Draw it** — in `EventsMapInner.tsx`:

Imports: `import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';` and add `AREA_PATH_OPTIONS, ORIGIN_ANCHOR, ORIGIN_SIZE, originMarkup` to the `./markerVisuals` import.

Above `EventsMapInnerProps`:

```ts
/** A proximity filter's circle: centre and radius in metres. */
export interface MapArea {
  lat: number;
  lng: number;
  radius: number;
}
```

In `EventsMapInnerProps`, after `renderPopup`:

```ts
  // A proximity filter's circle. Drawn with its centre, and — with fitToEvents
  // — framed instead of the pins: every pin is inside it anyway, and the circle
  // also shows the area that came up empty.
  area?: MapArea | null;
```

`MarkersLayerProps` gains `area: MapArea | null;`. In `MarkersLayer`, destructure `area`, and before the `useEffect` read primitives (the filters are re-parsed on every render, so an object dependency would rebuild every marker on every render):

```ts
  const areaLat = area?.lat;
  const areaLng = area?.lng;
  const areaRadius = area?.radius;
```

Replace the fit block with:

```ts
    if (fitToEvents && usable.length > 0) {
      const bounds =
        areaLat !== undefined && areaLng !== undefined && areaRadius !== undefined
          ? L.latLng(areaLat, areaLng).toBounds(areaRadius * 2)
          : L.latLngBounds(usable.map((e) => [e.location.lat as number, e.location.lng as number]));
      // padding keeps pins off the edges where popups would clip.
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }
```

and add `areaLat, areaLng, areaRadius` to the effect's dependency array.

Add a layer component above `PopupTitleTranslator`:

```tsx
// The circle and its centre. Neither takes clicks: they would otherwise sit on
// top of the very pins they surround.
function AreaLayer({ area }: { area: MapArea }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: originMarkup(),
        className: styles.originIcon,
        iconSize: ORIGIN_SIZE,
        iconAnchor: ORIGIN_ANCHOR,
      }),
    []
  );
  return (
    <>
      <Circle
        center={[area.lat, area.lng]}
        radius={area.radius}
        pathOptions={AREA_PATH_OPTIONS}
        interactive={false}
      />
      <Marker
        position={[area.lat, area.lng]}
        icon={icon}
        interactive={false}
        keyboard={false}
        zIndexOffset={-1000}
      />
    </>
  );
}
```

In `EventsMapInner`, destructure `area = null`, render `{area && <AreaLayer area={area} />}` right after `<TileLayer …/>`, and pass `area={area}` to `<MarkersLayer>`.

In `EventsMap.tsx`, below the `EventsMapProps` export: `export type { MapArea } from './EventsMapInner';`

In `EventsMap.module.scss`, after `.pinIcon`:

```scss
// The proximity filter's centre marker — a div-icon like the pins, so its SVG
// must not be boxed by Leaflet's default tile either.
.originIcon {
  background: none !important;
  border: none !important;
}
```

- [ ] **Step 4: Run and commit**

Run: `pnpm vitest run src/components/common/EventsMap && pnpm type-check && pnpm lint`
Expected: PASS / clean.

```bash
git add src/components/common/EventsMap
git commit -m "feat(map): draw the proximity circle and frame it"
```

---

### Task 9: Radius slider

**Files:**
- Create: `src/components/ui/RadiusSlider/RadiusSlider.tsx`, `RadiusSlider.spec.tsx`

- [ ] **Step 1: Failing test** — `RadiusSlider.spec.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import RadiusSlider from './RadiusSlider';

describe('RadiusSlider', () => {
  it('states the radius in words a screen reader can say', () => {
    render(<RadiusSlider value={1500} onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Promień' })).toHaveAttribute(
      'aria-valuetext',
      '1,5 km'
    );
  });

  it('moves in 500 m steps and reports the new radius', () => {
    const onChange = vi.fn();
    render(<RadiusSlider value={1000} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(1500);
  });

  it('stops at 500 m', () => {
    const onChange = vi.fn();
    render(<RadiusSlider value={5000} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'Home' });

    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it('passes accessibility check', async () => {
    const { container } = render(<RadiusSlider value={1000} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

Run: `pnpm vitest run src/components/ui/RadiusSlider` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement** — `RadiusSlider.tsx`

```tsx
'use client';

import { useId, useState } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';
import { MAX_RADIUS_M, MIN_RADIUS_M, RADIUS_STEP_M } from '@/lib/geo';
import { formatDistance } from '@/lib/utils';

interface RadiusSliderProps {
  /** Metres. */
  value: number;
  /** Called when the thumb is released or a key is pressed — not on every pixel of a drag. */
  onChange: (radius: number) => void;
}

export default function RadiusSlider({ value, onChange }: Readonly<RadiusSliderProps>) {
  const { t, locale } = useTranslation();
  const labelId = useId();
  // The thumb follows a drag locally and the value is reported on release, so
  // a drag across the whole range is one URL change and one query, not ten.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = dragValue ?? value;
  const format = (radius: number) => formatDistance(radius, locale);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography id={labelId} variant="body2" component="span" sx={{ fontWeight: 600 }}>
          {t.NEAR_RADIUS}
        </Typography>
        <Typography
          variant="body2"
          component="span"
          aria-hidden
          sx={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent-primary)' }}
        >
          {format(shown)}
        </Typography>
      </Box>
      <Slider
        value={shown}
        min={MIN_RADIUS_M}
        max={MAX_RADIUS_M}
        step={RADIUS_STEP_M}
        marks
        size="small"
        aria-labelledby={labelId}
        getAriaValueText={format}
        onChange={(_, next) => setDragValue(next as number)}
        onChangeCommitted={(_, next) => {
          setDragValue(null);
          onChange(next as number);
        }}
        // Inset so the thumb is not clipped at either end of a narrow panel.
        sx={{ mx: 1, width: 'calc(100% - 16px)' }}
      />
    </Box>
  );
}
```

- [ ] **Step 3: Run and commit**

Run: `pnpm vitest run src/components/ui/RadiusSlider`
Expected: PASS.

```bash
git add src/components/ui/RadiusSlider
git commit -m "feat(ui): a 500 m – 5 km radius slider that commits on release"
```

---

### Task 10: Picking a point on a map

**Files:**
- Create: `src/components/common/LocationPicker/LocationPickerDialog.tsx`, `LocationPickerMap.tsx`, `LocationPicker.module.scss`, `LocationPickerDialog.spec.tsx`

- [ ] **Step 1: Failing test** — `LocationPickerDialog.spec.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LatLng } from '@/lib/geo';
import LocationPickerDialog from './LocationPickerDialog';

// Leaflet cannot run in jsdom; the stand-in exposes the two things the map
// reports — a click and where it is centred.
vi.mock('./LocationPickerMap', () => ({
  default: ({
    onPick,
    onCenterChange,
  }: {
    onPick: (p: LatLng) => void;
    onCenterChange: (p: LatLng) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onPick({ lat: 51.1, lng: 17.03 })}>
        map click
      </button>
      <button type="button" onClick={() => onCenterChange({ lat: 51.2, lng: 17.1 })}>
        map pan
      </button>
    </div>
  ),
}));

const CITY = { lat: 51.1079, lng: 17.0385 };

function renderDialog(overrides: Partial<React.ComponentProps<typeof LocationPickerDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <LocationPickerDialog
      fallbackCenter={CITY}
      initialPoint={null}
      initialRadius={1000}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
}

describe('LocationPickerDialog', () => {
  it('cannot apply before a point is dropped', async () => {
    renderDialog();
    await screen.findByRole('button', { name: 'map click' });
    expect(screen.getByRole('button', { name: 'Zastosuj' })).toBeDisabled();
  });

  it('applies the dropped point with the radius chosen in the dialog', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'map click' }));
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));

    expect(onConfirm).toHaveBeenCalledWith({ lat: 51.1, lng: 17.03 }, 1500);
  });

  // A keyboard cannot click a map, but it can pan one.
  it('drops the pin where the map is centred', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'map pan' }));
    await user.click(screen.getByRole('button', { name: 'Postaw na środku mapy' }));
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));

    expect(onConfirm).toHaveBeenCalledWith({ lat: 51.2, lng: 17.1 }, 1000);
  });

  it('starts from the current point, so Apply works straight away', async () => {
    renderDialog({ initialPoint: { lat: 51.11, lng: 17.032 } });
    await screen.findByRole('button', { name: 'map click' });
    expect(screen.getByRole('button', { name: 'Zastosuj' })).toBeEnabled();
  });

  it('cancels', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm vitest run src/components/common/LocationPicker` — Expected: FAIL (module missing).

- [ ] **Step 2: Styles** — `LocationPicker.module.scss`

```scss
.mapSlot {
  height: min(60vh, 420px);
  margin: 12px 0 8px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}

.map {
  width: 100%;
  height: 100%;
}

.placeholder {
  width: 100%;
  height: 100%;
}

// A div-icon: its SVG must not be boxed by Leaflet's default tile.
.originIcon {
  background: none !important;
  border: none !important;
}
```

- [ ] **Step 3: The map** — `LocationPickerMap.tsx`

```tsx
'use client';

// Leaflet touches `window` at import time, so this module is only ever loaded
// through the dynamic import in LocationPickerDialog (ssr: false).
import { useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@/lib/geo';
import {
  AREA_PATH_OPTIONS,
  ORIGIN_ANCHOR,
  ORIGIN_SIZE,
  originMarkup,
} from '@/components/common/EventsMap/markerVisuals';
import 'leaflet/dist/leaflet.css';
import styles from './LocationPicker.module.scss';

export interface LocationPickerMapProps {
  /** Where the map opens. Read once, like every MapContainer prop. */
  initialCenter: LatLng;
  point: LatLng | null;
  radius: number;
  onPick: (point: LatLng) => void;
  /** Reports where the map is centred, for "drop it at the centre". */
  onCenterChange: (center: LatLng) => void;
}

function MapEvents({
  onPick,
  onCenterChange,
}: Pick<LocationPickerMapProps, 'onPick' | 'onCenterChange'>) {
  const map = useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    moveend: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

export default function LocationPickerMap({
  initialCenter,
  point,
  radius,
  onPick,
  onCenterChange,
}: Readonly<LocationPickerMapProps>) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: originMarkup(),
        className: styles.originIcon,
        iconSize: ORIGIN_SIZE,
        iconAnchor: ORIGIN_ANCHOR,
      }),
    []
  );

  return (
    <MapContainer center={[initialCenter.lat, initialCenter.lng]} zoom={14} className={styles.map}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onPick={onPick} onCenterChange={onCenterChange} />
      {point && (
        <>
          <Circle
            center={[point.lat, point.lng]}
            radius={radius}
            pathOptions={AREA_PATH_OPTIONS}
            interactive={false}
          />
          <Marker
            position={[point.lat, point.lng]}
            icon={icon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const next = (event.target as L.Marker).getLatLng();
                onPick({ lat: next.lat, lng: next.lng });
              },
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
```

- [ ] **Step 4: The dialog** — `LocationPickerDialog.tsx`

```tsx
'use client';

import { useId, useState } from 'react';
import dynamic from 'next/dynamic';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { useTranslation } from '@/i18n';
import RadiusSlider from '@/components/ui/RadiusSlider/RadiusSlider';
import type { LatLng } from '@/lib/geo';
import styles from './LocationPicker.module.scss';

// Leaflet cannot load during the static export's prerender.
const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

interface LocationPickerDialogProps {
  /** Where the map opens when there is no point yet: the city centre. */
  fallbackCenter: LatLng;
  initialPoint: LatLng | null;
  initialRadius: number;
  onCancel: () => void;
  onConfirm: (point: LatLng, radius: number) => void;
}

/**
 * Drop a pin instead of typing an address. Mounted only while open, so each
 * opening starts from the filter's current point rather than from wherever a
 * cancelled attempt left the pin.
 */
export default function LocationPickerDialog({
  fallbackCenter,
  initialPoint,
  initialRadius,
  onCancel,
  onConfirm,
}: Readonly<LocationPickerDialogProps>) {
  const { t } = useTranslation();
  const titleId = useId();
  const muiTheme = useTheme();
  // A map wants every pixel a phone has.
  const fullScreen = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [point, setPoint] = useState<LatLng | null>(initialPoint);
  const [radius, setRadius] = useState(initialRadius);
  const [center, setCenter] = useState<LatLng>(initialPoint ?? fallbackCenter);

  return (
    <Dialog
      open
      onClose={onCancel}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId} sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
        {t.NEAR_PICKER_TITLE}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
          {t.NEAR_PICKER_HINT}
        </Typography>
        <div className={styles.mapSlot}>
          <LocationPickerMap
            initialCenter={initialPoint ?? fallbackCenter}
            point={point}
            radius={radius}
            onPick={setPoint}
            onCenterChange={setCenter}
          />
        </div>
        {/* A keyboard cannot click a map, but it can pan one (arrow keys); this
            drops the pin wherever the panning stopped. */}
        <Button
          size="small"
          startIcon={<CenterFocusStrongIcon />}
          onClick={() => setPoint(center)}
          sx={{ mb: 2 }}
        >
          {t.NEAR_PICKER_USE_CENTER}
        </Button>
        <RadiusSlider value={radius} onChange={setRadius} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>{t.NEAR_PICKER_CANCEL}</Button>
        <Button
          variant="contained"
          disabled={!point}
          onClick={() => {
            if (point) onConfirm(point, radius);
          }}
        >
          {t.NEAR_PICKER_CONFIRM}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run and commit**

Run: `pnpm vitest run src/components/common/LocationPicker && pnpm type-check && pnpm lint`
Expected: PASS / clean. (If `next/dynamic` does not resolve the mocked module under jsdom, add to the spec a `vi.mock('next/dynamic', …)` that wraps the loader in `React.lazy` inside a `React.Suspense`.)

```bash
git add src/components/common/LocationPicker
git commit -m "feat(location): pick a point by dropping a pin on a map"
```

---

### Task 11: The nearby section

**Files:**
- Create: `src/components/common/NearbyFilter/AddressSearch.tsx`, `AddressSearch.spec.tsx`
- Create: `src/components/common/NearbyFilter/NearbyFilter.tsx`, `NearbyFilter.module.scss`, `NearbyFilter.spec.tsx`

- [ ] **Step 1: Failing test** — `AddressSearch.spec.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchAddresses } from '@/components/service/geocoding';
import AddressSearch from './AddressSearch';

vi.mock('@/components/service/geocoding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/service/geocoding')>()),
  searchAddresses: vi.fn(),
}));

const searchAddressesMock = vi.mocked(searchAddresses);

function renderSearch() {
  const onSelect = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AddressSearch onSelect={onSelect} />
    </QueryClientProvider>
  );
  return { onSelect, box: screen.getByRole('combobox', { name: 'Adres lub miejsce' }) };
}

beforeEach(() => {
  searchAddressesMock.mockReset();
});

describe('AddressSearch', () => {
  it('asks for three characters before searching', async () => {
    const user = userEvent.setup();
    const { box } = renderSearch();

    await user.type(box, 'Ry');

    expect(await screen.findByText('Wpisz co najmniej 3 znaki')).toBeInTheDocument();
    expect(searchAddressesMock).not.toHaveBeenCalled();
  });

  it('offers what the geocoder found and reports the pick', async () => {
    searchAddressesMock.mockResolvedValue([
      { id: 'W1', label: 'Świdnicka 12', detail: 'Stare Miasto, Wrocław', lat: 51.1069, lng: 17.0322 },
    ]);
    const user = userEvent.setup();
    const { onSelect, box } = renderSearch();

    await user.type(box, 'Świdnicka');
    await user.click(await screen.findByRole('option', { name: /Świdnicka 12/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: 'Świdnicka 12', lat: 51.1069 }));
    // Debounced: the half-typed prefixes never reached the geocoder.
    expect(searchAddressesMock).toHaveBeenCalledTimes(1);
    expect(searchAddressesMock).toHaveBeenCalledWith(
      'Świdnicka',
      expect.objectContaining({ lat: expect.any(Number) }),
      'pl',
      expect.anything()
    );
  });

  it('says so when the geocoder is down', async () => {
    searchAddressesMock.mockRejectedValue(new Error('503'));
    const user = userEvent.setup();
    const { box } = renderSearch();

    await user.type(box, 'Rynek');

    expect(await screen.findByText('Wyszukiwarka adresów jest chwilowo niedostępna')).toBeInTheDocument();
  });

  it('credits OpenStreetMap', () => {
    renderSearch();
    expect(screen.getByText(/© OpenStreetMap/)).toBeInTheDocument();
  });
});
```

Run: `pnpm vitest run src/components/common/NearbyFilter/AddressSearch.spec.tsx` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement** — `AddressSearch.tsx`

```tsx
'use client';

import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';
import { useAddressSearch } from '@/components/service/useAddressSearch';
import type { AddressSuggestion } from '@/components/service/geocoding';

interface AddressSearchProps {
  onSelect: (suggestion: AddressSuggestion) => void;
}

export default function AddressSearch({ onSelect }: Readonly<AddressSearchProps>) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { suggestions, isSearching, isError, tooShort } = useAddressSearch(input);

  let noOptionsText = t.NEAR_ADDRESS_NO_RESULTS;
  if (tooShort) noOptionsText = t.NEAR_ADDRESS_MIN_CHARS;
  else if (isError) noOptionsText = t.NEAR_ADDRESS_ERROR;

  return (
    <Box>
      <Autocomplete<AddressSuggestion>
        options={suggestions}
        value={null}
        inputValue={input}
        onInputChange={(_, next, reason) => {
          // 'reset' is the component writing the chosen option back into the
          // box; the box is emptied on selection instead.
          if (reason !== 'reset') setInput(next);
        }}
        onChange={(_, suggestion) => {
          if (!suggestion) return;
          onSelect(suggestion);
          setInput('');
        }}
        // Photon has matched already; filtering its answers again by the typed
        // text would hide "Świdnicka 12" from whoever typed "swidnicka 12".
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        loading={isSearching}
        loadingText={t.NEAR_ADDRESS_LOADING}
        noOptionsText={noOptionsText}
        autoHighlight
        blurOnSelect
        size="small"
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <li key={key} {...rest}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2">{option.label}</Typography>
                {option.detail && (
                  <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                    {option.detail}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField {...params} label={t.NEAR_ADDRESS_LABEL} placeholder={t.NEAR_ADDRESS_PLACEHOLDER} />
        )}
      />
      {/* Photon's data is OpenStreetMap's, under the ODbL, which asks for
          credit wherever it is shown. */}
      <Typography
        variant="caption"
        component="p"
        sx={{ mt: 0.5, color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}
      >
        {t.NEAR_ADDRESS_CREDIT}
      </Typography>
    </Box>
  );
}
```

Run: `pnpm vitest run src/components/common/NearbyFilter/AddressSearch.spec.tsx` — Expected: PASS.

- [ ] **Step 3: Failing test** — `NearbyFilter.spec.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LatLng } from '@/lib/geo';
import NearbyFilter from './NearbyFilter';

vi.mock('@/components/service/useAddressSearch', () => ({
  ADDRESS_MIN_CHARS: 3,
  useAddressSearch: () => ({
    suggestions: [{ id: 'W1', label: 'Świdnicka 12', detail: 'Wrocław', lat: 51.1069, lng: 17.0322 }],
    isSearching: false,
    isError: false,
    tooShort: false,
  }),
}));

vi.mock('@/components/common/LocationPicker/LocationPickerDialog', () => ({
  default: ({ onConfirm }: { onConfirm: (point: LatLng, radius: number) => void }) => (
    <button type="button" onClick={() => onConfirm({ lat: 51.12, lng: 17.04 }, 2000)}>
      picker: confirm
    </button>
  ),
}));

type Locate = (ok: PositionCallback, fail: PositionErrorCallback) => void;

function stubGeolocation(locate: Locate) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: vi.fn(locate) },
  });
}

const fixAt = (latitude: number, longitude: number): Locate => (ok) =>
  ok({ coords: { latitude, longitude } } as unknown as GeolocationPosition);

afterEach(() => {
  delete (navigator as { geolocation?: unknown }).geolocation;
  window.sessionStorage.clear();
});

const RYNEK = { lat: 51.11, lng: 17.032, radius: 1000, label: null };

describe('NearbyFilter', () => {
  it('sets the point from the device, coarsened to ~100 m, at the default radius', async () => {
    stubGeolocation(fixAt(51.109_87, 17.032_41));
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(onChange).toHaveBeenCalledWith({ lat: 51.11, lng: 17.032, radius: 1000, label: null });
  });

  it('calls this tab\'s own fix "your location"', async () => {
    stubGeolocation(fixAt(51.11, 17.032));
    const { rerender } = render(<NearbyFilter value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    rerender(<NearbyFilter value={RYNEK} onChange={vi.fn()} />);

    expect(screen.getByText('Twoja lokalizacja')).toBeInTheDocument();
  });

  // Someone else's location, arriving by a shared link, is not "yours".
  it('calls an unlabelled point from elsewhere "selected point"', () => {
    render(<NearbyFilter value={RYNEK} onChange={vi.fn()} />);
    expect(screen.getByText('Wybrany punkt')).toBeInTheDocument();
  });

  it.each([
    [1, 'Brak zgody na dostęp do lokalizacji'],
    [2, 'Nie udało się ustalić Twojej lokalizacji'],
    [3, 'Ustalanie lokalizacji trwało zbyt długo'],
  ])('explains a failed fix (code %i) and names the other ways in', async (code, message) => {
    stubGeolocation((_, fail) => fail({ code } as GeolocationPositionError));
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so when the browser has no geolocation at all', async () => {
    render(<NearbyFilter value={null} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ta przeglądarka nie udostępnia lokalizacji');
  });

  it('takes an address as the point, with its name', async () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.type(screen.getByRole('combobox', { name: 'Adres lub miejsce' }), 'Świd');
    await userEvent.click(await screen.findByRole('option', { name: /Świdnicka 12/ }));

    expect(onChange).toHaveBeenCalledWith({ lat: 51.1069, lng: 17.0322, radius: 1000, label: 'Świdnicka 12' });
  });

  it('takes a point dropped on the map, with the radius chosen there', async () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Wskaż na mapie' }));
    await userEvent.click(screen.getByRole('button', { name: 'picker: confirm' }));

    expect(onChange).toHaveBeenCalledWith({ lat: 51.12, lng: 17.04, radius: 2000, label: null });
  });

  it('changes the radius of the current point, keeping its name', () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={{ ...RYNEK, label: 'Rynek' }} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith({ ...RYNEK, label: 'Rynek', radius: 1500 });
  });

  it('keeps a radius chosen before the point and uses it when the point arrives', async () => {
    stubGeolocation(fixAt(51.11, 17.032));
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ radius: 1500 }));
  });

  it('removes the point', async () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={RYNEK} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Usuń lokalizację' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  // Rendered outside a CityProvider, the city is the default — Szczecin.
  it('warns when the point is far from the city', () => {
    render(<NearbyFilter value={{ lat: 50.06, lng: 19.94, radius: 1000, label: 'Kraków' }} onChange={vi.fn()} />);
    expect(screen.getByText(/daleko od wybranego miasta/)).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<NearbyFilter value={RYNEK} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

Run: `pnpm vitest run src/components/common/NearbyFilter/NearbyFilter.spec.tsx` — Expected: FAIL (module missing).

- [ ] **Step 4: Styles** — `NearbyFilter.module.scss`

```scss
.root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.current {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  border-radius: var(--radius-md);
  background-color: var(--color-accent-tint);
}

.currentName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error {
  line-height: 1.4;
}
```

- [ ] **Step 5: Implement** — `NearbyFilter.tsx`

```tsx
'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { useGeolocation, type GeolocationErrorKind } from '@/components/service/useGeolocation';
import LocationPickerDialog from '@/components/common/LocationPicker/LocationPickerDialog';
import RadiusSlider from '@/components/ui/RadiusSlider/RadiusSlider';
import { CITY_AREA_RADIUS_M, DEFAULT_RADIUS_M, distanceMeters, type LatLng } from '@/lib/geo';
import type { NearFilter } from '@/types/filter.types';
import AddressSearch from './AddressSearch';
import { nearPlaceName } from './nearPlaceName';
import styles from './NearbyFilter.module.scss';

interface NearbyFilterProps {
  value: NearFilter | null;
  onChange: (next: NearFilter | null) => void;
}

/**
 * The "near a point" section of the filter panel: the point, three ways to set
 * it — the device's location, an address, a pin on a map — and the radius.
 */
export default function NearbyFilter({ value, onChange }: Readonly<NearbyFilterProps>) {
  const { t } = useTranslation();
  const { city } = useCity();
  const { locate, isLocating, error } = useGeolocation();
  // A radius chosen before there is a point waits here for one.
  const [pendingRadius, setPendingRadius] = useState(DEFAULT_RADIUS_M);
  const [pickerOpen, setPickerOpen] = useState(false);
  const radius = value?.radius ?? pendingRadius;

  const errorMessages: Record<GeolocationErrorKind, string> = {
    denied: t.NEAR_ERROR_DENIED,
    unavailable: t.NEAR_ERROR_UNAVAILABLE,
    timeout: t.NEAR_ERROR_TIMEOUT,
    unsupported: t.NEAR_ERROR_UNSUPPORTED,
  };

  const choosePoint = (point: LatLng, label: string | null, nextRadius = radius) =>
    onChange({ lat: point.lat, lng: point.lng, radius: nextRadius, label });

  const handleMyLocation = async () => {
    const fix = await locate();
    if (fix) choosePoint(fix, null);
  };

  const handleRadius = (next: number) => {
    setPendingRadius(next);
    if (value) onChange({ ...value, radius: next });
  };

  const farFromCity =
    value !== null && distanceMeters(value, city.coordinates) > CITY_AREA_RADIUS_M;

  return (
    <Box className={styles.root}>
      {value && (
        <Box className={styles.current}>
          <PlaceIcon sx={{ fontSize: 18, color: 'var(--color-accent-primary)', flexShrink: 0 }} />
          <Typography variant="body2" className={styles.currentName} sx={{ fontWeight: 600 }}>
            {nearPlaceName(value, t)}
          </Typography>
          <IconButton size="small" aria-label={t.NEAR_REMOVE} onClick={() => onChange(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      {farFromCity && (
        <Alert severity="info" sx={{ py: 0, fontSize: '0.75rem' }}>
          {t.NEAR_FAR_FROM_CITY}
        </Alert>
      )}

      <Button
        variant="outlined"
        size="small"
        fullWidth
        onClick={handleMyLocation}
        disabled={isLocating}
        startIcon={isLocating ? <CircularProgress size={14} /> : <MyLocationIcon />}
      >
        {isLocating ? t.NEAR_LOCATING : t.NEAR_USE_MY_LOCATION}
      </Button>
      {error && (
        <Typography role="alert" variant="caption" color="error" className={styles.error}>
          {errorMessages[error]}
        </Typography>
      )}

      <AddressSearch onSelect={(suggestion) => choosePoint(suggestion, suggestion.label)} />

      <Button
        size="small"
        startIcon={<MapOutlinedIcon />}
        onClick={() => setPickerOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t.NEAR_PICK_ON_MAP}
      </Button>

      <RadiusSlider value={radius} onChange={handleRadius} />

      {pickerOpen && (
        <LocationPickerDialog
          fallbackCenter={city.coordinates}
          initialPoint={value}
          initialRadius={radius}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(point, pickedRadius) => {
            setPickerOpen(false);
            setPendingRadius(pickedRadius);
            choosePoint(point, null, pickedRadius);
          }}
        />
      )}
    </Box>
  );
}
```

- [ ] **Step 6: Run and commit**

Run: `pnpm vitest run src/components/common/NearbyFilter && pnpm type-check && pnpm lint`
Expected: PASS / clean.

```bash
git add src/components/common/NearbyFilter
git commit -m "feat(filters): a nearby section — my location, an address, or a pin"
```

---

### Task 12: In the filter panel

**Files:**
- Modify: `src/components/common/FilterPanel/FilterPanel.tsx`, `FilterPanel.spec.tsx`

- [ ] **Step 1: Failing test** — in `FilterPanel.spec.tsx` add imports `import userEvent from '@testing-library/user-event';` and `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';`, then:

```tsx
  it('offers a nearby section with the three ways to set a point', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FilterPanel />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'W pobliżu' }));

    expect(await screen.findByRole('button', { name: 'Użyj mojej lokalizacji' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Adres lub miejsce' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wskaż na mapie' })).toBeInTheDocument();
  });
```

Run: `pnpm vitest run src/components/common/FilterPanel` — Expected: FAIL (no "W pobliżu").

- [ ] **Step 2: Implement** — in `FilterPanel.tsx` add `import NearbyFilter from '@/components/common/NearbyFilter/NearbyFilter';` and insert after the Hour accordion's closing `</Accordion>` and its following `<Divider …/>`, before `{/* Categories */}`:

```tsx
      {/* Nearby. Mounted only while open: it holds a geocoder query and a
          slider nobody needs until they ask for a place. */}
      <Accordion disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--color-text-muted)' }} />}>
          <Badge
            badgeContent={filters.near ? 1 : undefined}
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
          >
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {t.FILTER_NEAR}
            </Typography>
          </Badge>
        </AccordionSummary>
        <AccordionDetails>
          <NearbyFilter value={filters.near} onChange={(near) => updateFilters({ near })} />
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ borderColor: 'var(--color-border)' }} />
```

- [ ] **Step 3: Run and commit**

Run: `pnpm vitest run src/components/common/FilterPanel`
Expected: PASS.

```bash
git add src/components/common/FilterPanel
git commit -m "feat(filters): the nearby section in the filter panel"
```

---

### Task 13: In the results

**Files:**
- Modify: `src/components/ui/EventMeta/EventMeta.tsx`, `EventMeta.module.scss`
- Modify: `src/components/common/EventCard/EventCard.tsx`, `EventCard.spec.tsx`
- Modify: `src/components/common/EventRow/EventRow.tsx`, `EventRow.spec.tsx`
- Modify: `src/components/common/EventGrid/EventGrid.tsx`, `src/components/common/EventList/EventList.tsx`
- Modify: `src/components/ui/SortSelect/SortSelect.tsx`, `SortSelect.spec.tsx`
- Modify: `src/components/views/EventsListView/EventsListView.tsx`, `EventsListView.spec.tsx`

- [ ] **Step 1: Failing tests**

`SortSelect.spec.tsx`:

```tsx
  it('does not offer distance without a point to measure from', async () => {
    const user = userEvent.setup();
    renderControl();
    await user.click(screen.getByRole('combobox', { name: 'Sortuj' }));
    expect(screen.queryByRole('option', { name: 'Odległość' })).not.toBeInTheDocument();
  });

  it('offers distance with one', async () => {
    const user = userEvent.setup();
    const { onSortChange } = renderControl({ withDistance: true });
    await user.click(screen.getByRole('combobox', { name: 'Sortuj' }));
    await user.click(screen.getByRole('option', { name: 'Odległość' }));
    expect(onSortChange).toHaveBeenCalledWith('distance');
  });
```

`EventCard.spec.tsx` (use the spec's existing event fixture; its coordinates are `location.lat`/`lng`):

```tsx
  it('says how far the venue is from the chosen point', () => {
    const origin = { lat: (event.location.lat as number) + 0.0076, lng: event.location.lng as number };
    render(<EventCard event={event} distanceFrom={origin} />);
    expect(screen.getByText('850 m')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAccessibleName(/850 m od wybranego punktu/);
  });
```

`EventRow.spec.tsx`: the same test with `<EventRow event={event} distanceFrom={origin} />`.

`EventsListView.spec.tsx` — make the filters swappable: replace the inline filters object in the `useEvents` mock with `filters: mocks.filters`, declared above the mocks as

```tsx
const baseFilters = {
  search: '',
  categories: [],
  dateMode: null,
  dateSingle: null,
  dateFrom: null,
  dateTo: null,
  weekdays: [],
  hourFrom: null,
  hourTo: null,
  freeOnly: false,
  near: null,
  page: 1,
  pageSize: 15,
  viewMode: 'grid',
  sort: 'date',
  dir: 'asc',
};
const mocks = vi.hoisted(() => ({ filters: {} as Record<string, unknown> }));
```

with `beforeEach(() => { mocks.filters = { ...baseFilters }; });`, and add:

```tsx
  it('shows the proximity filter as a chip naming the radius and the place', () => {
    mocks.filters = { ...baseFilters, near: { lat: 51.11, lng: 17.032, radius: 1500, label: 'Rynek' } };
    render(<EventsListView />);
    expect(screen.getByText('W promieniu 1,5 km: Rynek')).toBeInTheDocument();
  });
```

Run: `pnpm vitest run src/components/ui/SortSelect src/components/common/EventCard src/components/common/EventRow src/components/views/EventsListView` — Expected: FAIL.

- [ ] **Step 2: Venue line** — `EventMeta.tsx`, replace `EventVenueProps`/`EventVenue`:

```tsx
interface EventVenueProps {
  name: string;
  /** How far the venue is from the proximity filter's point, preformatted. */
  distance?: string;
}

export function EventVenue({ name, distance }: EventVenueProps) {
  return (
    <span className={styles.venue}>
      {/* sx, not a CSS Module class: MUI's emotion styles are injected at the
          end of <head> and outrank equal-specificity module classes, so
          font-size here would be clobbered. */}
      <PlaceIcon sx={{ fontSize: 13, color: 'var(--color-text-muted)', flexShrink: 0 }} />
      {/* Venue names are proper nouns, not translated — translate="no" also
          keeps the page-level Google fallback widget from rewriting them. */}
      <span className={styles.venueText} translate="no">{name}</span>
      {/* Outside the ellipsis: a long venue name may be cut short, the distance
          never is — it is the reason the list is in the order it is. */}
      {distance && <span className={styles.venueDistance}>{distance}</span>}
    </span>
  );
}
```

`EventMeta.module.scss`, after `.venueText`:

```scss
.venueDistance {
  flex-shrink: 0;
  margin-left: 2px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-accent-primary);
  white-space: nowrap;
}
```

- [ ] **Step 3: Cards and rows**

`EventCard.tsx`: extend the `@/lib/utils` import with `formatEventDistance`; add `import type { LatLng } from '@/lib/geo';`. Props gain:

```ts
  /** The proximity filter's point, when one is set: the card then says how far away the venue is. */
  distanceFrom?: LatLng | null;
```

Signature: `export default function EventCard({ event, href: hrefOverride, distanceFrom }: EventCardProps)`. Replace `const { locale } = useTranslation();` with `const { t, locale } = useTranslation();` and add below it:

```ts
  const distance = formatEventDistance(event, distanceFrom, locale);
```

The `aria-label` array becomes `[translatedName, formatDateShort(event.date, locale), time, event.location.name, distance && t.EVENT_DISTANCE(distance)]`, and the venue line `<EventVenue name={event.location.name} distance={distance} />`.

`EventRow.tsx`: add `import { useTranslation } from '@/i18n';` and `import type { LatLng } from '@/lib/geo';`, extend the utils import with `formatEventDistance`; props gain the same `distanceFrom` field; in the body:

```ts
  const { t, locale } = useTranslation();
  const distance = formatEventDistance(event, distanceFrom, locale);
```

`aria-label={[translatedName, event.date, event.location.name, distance && t.EVENT_DISTANCE(distance)].filter(Boolean).join(', ')}` and `<EventVenue name={event.location.name} distance={distance} />`.

`EventGrid.tsx`: props gain

```ts
  /** The proximity filter's point: each card then states its distance from it. */
  origin?: LatLng | null;
```

(with `import type { LatLng } from '@/lib/geo';`), destructure `origin`, render `<EventCard key={event.id} event={event} href={hrefFor?.(event)} distanceFrom={origin} />`.

`EventList.tsx`: the same `origin` prop, `<EventRow key={event.id} event={event} distanceFrom={origin} />`.

- [ ] **Step 4: Sort option** — `SortSelect.tsx`: props gain

```ts
  /** Offer ordering by distance — only meaningful while there is a point to measure from. */
  withDistance?: boolean;
```

destructure `withDistance = false`; `labels` gains `distance: t.SORT_DISTANCE`; and render options from

```ts
  const keys: SortKey[] = withDistance ? [...SORT_KEYS, 'distance'] : SORT_KEYS;
```

- [ ] **Step 5: The list view** — `EventsListView.tsx`:

Imports: `formatDistance` from `@/lib/utils`, `nearPlaceName` from `@/components/common/NearbyFilter/nearPlaceName`.

In `renderBody`: the map gets `area={filters.near}`; the grid/list line becomes

```tsx
  return filters.viewMode === 'grid' ? (
    <EventGrid events={events} origin={filters.near} />
  ) : (
    <EventList events={events} origin={filters.near} />
  );
```

In the component: `const { t, locale } = useTranslation();`; after the `freeOnly` chip:

```ts
  if (filters.near) {
    activeChips.push({
      key: 'near',
      label: t.NEAR_CHIP(formatDistance(filters.near.radius, locale), nearPlaceName(filters.near, t)),
    });
  }
```

in the chip `onDelete` chain, after the `freeOnly` branch: `else if (chip.key === 'near') updateFilter({ near: null });`

and `<SortSelect … withDistance={filters.near !== null} />`.

- [ ] **Step 6: Run and commit**

Run: `pnpm vitest run src/components && pnpm type-check && pnpm lint`
Expected: PASS / clean.

```bash
git add src/components
git commit -m "feat(events): distances on cards, a distance sort, the circle and a chip"
```

---

### Task 14: Presets keep the point

**Files:**
- Modify: `src/types/preset.types.ts`, `src/lib/presets.ts`, `src/lib/presets.spec.ts`, `src/lib/tourSteps.ts`
- Modify: `src/components/views/MyFiltersView/MyFiltersView.tsx`, `MyFiltersView.spec.tsx`
- Modify: `src/components/views/MyFiltersView/PresetEditorDialog.tsx`, `PresetEditorDialog.spec.tsx`

- [ ] **Step 1: Failing tests** — append to `src/lib/presets.spec.ts`:

```ts
describe('the proximity filter in presets', () => {
  const near = { lat: 51.11, lng: 17.032, radius: 1500, label: 'Rynek' };

  it('is captured from the filters on screen, as a copy', () => {
    const current = { ...getDefaultFilters(), near };
    const saved = presetFiltersFromEventFilters(current);
    expect(saved.near).toEqual(near);
    expect(saved.near).not.toBe(near);
  });

  it('opens as the same point, radius and name', () => {
    const href = presetHref(makePreset({ filters: { ...emptyPresetFilters(), near } }), MONDAY);
    const params = new URL(href, 'https://x.test').searchParams;
    expect(params.get('near')).toBe('51.11,17.032');
    expect(params.get('radius')).toBe('1500');
    expect(params.get('nearLabel')).toBe('Rynek');
  });

  it('round-trips through storage', () => {
    const presets = [makePreset({ filters: { ...emptyPresetFilters(), near } })];
    expect(parsePresets(serializePresets(presets))[0].filters.near).toEqual(near);
  });

  it('repairs a stored point the way the URL does, and drops one that is unusable', () => {
    const stored = (value: unknown) =>
      parsePresets(
        JSON.stringify([{ ...makePreset(), filters: { ...emptyPresetFilters(), near: value } }])
      )[0].filters.near;
    expect(stored({ lat: 51.11, lng: 17.032, radius: 99_999, label: 'Rynek' })?.radius).toBe(5000);
    expect(stored({ lat: 51.11, lng: 17.032 })).toEqual({ lat: 51.11, lng: 17.032, radius: 1000, label: null });
    expect(stored({ lat: 'x', lng: 17.032, radius: 1000 })).toBeNull();
    expect(stored({ lat: 95, lng: 17.032, radius: 1000 })).toBeNull();
    expect(stored('51.11,17.032')).toBeNull();
  });

  it('is copied, not shared, when a preset is duplicated', () => {
    const presets = [makePreset({ filters: { ...emptyPresetFilters(), near } })];
    const [original, copy] = duplicatePreset(presets, 'p1', 'p2', 'Copy', '2026-07-28T10:00:00.000Z');
    expect(copy.filters.near).toEqual(original.filters.near);
    expect(copy.filters.near).not.toBe(original.filters.near);
  });
});
```

Run: `pnpm vitest run src/lib/presets.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Implement**

`preset.types.ts`: import `NearFilter` alongside the other filter types and add to `PresetFilters`, after `freeOnly: boolean;`:

```ts
  // A fixed point: "near the office" means the office every time it is opened.
  // (A "near me, wherever I am" preset would be the location twin of the
  // relative date windows; nobody has asked for it yet.)
  near: NearFilter | null;
```

`presets.ts`:
- import `NearFilter` from `@/types/filter.types` and change the filterUtils import to `import { filtersToSearchParams, parseNear } from './filterUtils';`
- `emptyPresetFilters`: `near: null,` after `freeOnly`
- `presetFiltersFromEventFilters`: `near: filters.near ? { ...filters.near } : null,`
- `presetToEventFilters`: `near: preset.filters.near,`
- helper next to the other `as*` helpers:

```ts
// Stored presets are untrusted input (see parsePresets), and a point is opened
// by turning it into a query string — so it passes the URL's own gate.
function asNear(value: unknown): NearFilter | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.lat !== 'number' || typeof v.lng !== 'number') return null;
  return parseNear(
    `${v.lat},${v.lng}`,
    typeof v.radius === 'number' ? String(v.radius) : null,
    typeof v.label === 'string' ? v.label : null
  );
}
```

- `parsePresetFilters`: `near: asNear(value.near),` after `freeOnly`
- `duplicatePreset` copy's `filters`: add `near: presets[index].filters.near ? { ...presets[index].filters.near } : null,`

`tourSteps.ts` `storyPresetFilters`: `near: null,` after `freeOnly: false,`.

- [ ] **Step 3: Summary and editor** — `MyFiltersView.tsx`: import `formatDistance` from `@/lib/utils`; in `summarise`, after the `freeOnly` line:

```ts
    if (preset.filters.near) {
      parts.push(
        t.NEAR_CHIP(
          formatDistance(preset.filters.near.radius, locale),
          // A saved point is fixed, so it is never "your location": that may
          // have moved since.
          preset.filters.near.label ?? t.NEAR_PICKED_POINT
        )
      );
    }
```

`PresetEditorDialog.tsx`: import `formatDistance` from `@/lib/utils`. The city field's `onChange` becomes:

```tsx
          onChange={(e) => {
            const cityId = e.target.value;
            setPreset((p) => ({
              ...p,
              cityId,
              // A point is a place in one city; carried to another it would
              // ask for events nowhere near it.
              filters: { ...p.filters, near: cityId === p.cityId ? p.filters.near : null },
            }));
          }}
```

and before the free-only `<FormControlLabel>`:

```tsx
        {/* Set from the events list, where there is a map and a geocoder; here
            it can only be kept or dropped. */}
        {filters.near && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t.FILTER_NEAR}
            </Typography>
            <Chip
              label={t.NEAR_CHIP(
                formatDistance(filters.near.radius, locale),
                filters.near.label ?? t.NEAR_PICKED_POINT
              )}
              onDelete={() => setFilters({ near: null })}
              size="small"
            />
          </Box>
        )}
```

Tests — `MyFiltersView.spec.tsx` (follow its existing seeding of `localStorage` with a preset): a tile for a preset with `near: { lat: 51.11, lng: 17.032, radius: 1500, label: 'Rynek' }` shows text matching `/W promieniu 1,5\skm: Rynek/`. `PresetEditorDialog.spec.tsx`: for a draft carrying that `near`, the chip is shown; clicking its delete icon (`screen.getByTestId('CancelIcon')`) and saving yields `filters.near === null`; choosing another city and saving also yields `filters.near === null`.

- [ ] **Step 4: Run and commit**

Run: `pnpm vitest run src/lib src/components/views/MyFiltersView src/components/common/Onboarding && pnpm type-check`
Expected: PASS.

```bash
git add src/types/preset.types.ts src/lib/presets.ts src/lib/presets.spec.ts src/lib/tourSteps.ts src/components/views/MyFiltersView
git commit -m "feat(presets): a saved filter keeps its point and radius"
```

---

### Task 15: Privacy page

**Files:**
- Modify: `src/components/views/PrivacyView/PrivacyView.tsx`, `PrivacyView.spec.tsx`

- [ ] **Step 1: Failing test** — add to `PrivacyView.spec.tsx`:

```tsx
  it('explains what happens to a location and to a typed address', () => {
    render(<PrivacyView />);
    expect(screen.getByRole('heading', { level: 2, name: 'Lokalizacja' })).toBeInTheDocument();
    expect(screen.getByText(/zaokrąglamy ją do ok\. 100 m/)).toBeInTheDocument();
    expect(screen.getByText(/Komoot GmbH/)).toBeInTheDocument();
  });
```

Run: `pnpm vitest run src/components/views/PrivacyView` — Expected: FAIL.

- [ ] **Step 2: Implement** — in `PrivacyView.tsx` `sections`, after the `what` entry:

```ts
    { key: 'location', heading: t.PRIVACY_LOCATION_HEADING, body: t.PRIVACY_LOCATION_BODY },
```

- [ ] **Step 3: Run and commit**

Run: `pnpm vitest run src/components/views/PrivacyView`
Expected: PASS.

```bash
git add src/components/views/PrivacyView
git commit -m "docs(privacy): say what happens to a location and a typed address"
```

---

### Task 16: End to end

**Files:**
- Modify: `e2e/support/helpers.ts` (`TEXT`)
- Create: `e2e/nearby.spec.ts`

- [ ] **Step 1: Strings** — add to `TEXT` in `helpers.ts`:

```ts
  // The "W pobliżu" (nearby) filter section, its controls, and how its chip
  // names a point.
  nearSection: 'W pobliżu',
  nearUseMyLocation: 'Użyj mojej lokalizacji',
  nearAddress: 'Adres lub miejsce',
  nearMyLocation: 'Twoja lokalizacja',
```

- [ ] **Step 2: The spec** — `e2e/nearby.spec.ts`

```ts
import { test, expect, type Page } from '@playwright/test';
import { CITY, TEXT, activeChip, closeFilters, openFilters, waitForList } from './support/helpers';

// Wrocław's Rynek. As everywhere in this suite, nothing asserts what the
// scrape put near it — only that the filter is applied and honoured.
const RYNEK = { lat: 51.11, lng: 17.032 };

async function openNearby(page: Page): Promise<void> {
  await openFilters(page);
  await page.getByRole('button', { name: TEXT.nearSection }).click();
}

/** Every card's stated distance, in metres, in list order. */
async function cardDistances(page: Page): Promise<number[]> {
  const texts = await page.locator('article').allInnerTexts();
  return texts.flatMap((text) => {
    const match = text.match(/(\d+(?:,\d)?)\s(k?m)(?![a-z])/);
    if (!match) return [];
    const value = Number(match[1].replace(',', '.'));
    return [match[2] === 'km' ? value * 1000 : value];
  });
}

test.describe('Events near a point', () => {
  test('"use my location" filters around the device, coarsened to ~100 m', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.109_87, longitude: 17.032_41 });
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);
    await openNearby(page);

    await page.getByRole('button', { name: TEXT.nearUseMyLocation }).click();

    await expect(page).toHaveURL(/[?&]near=51\.11%2C17\.032(&|$)/);
    await expect(page).toHaveURL(/[?&]radius=1000(&|$)/);
    await closeFilters(page);
    await expect(activeChip(page, TEXT.nearMyLocation)).toBeVisible();
  });

  test('an address picked from the suggestions becomes the point', async ({ page }) => {
    // Photon is a third party: stubbed, so this suite never depends on it.
    await page.route(/photon\.komoot\.io\/api/, (route) =>
      route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [17.0322, 51.1069] },
              properties: {
                osm_type: 'W',
                osm_id: 101136527,
                street: 'Świdnicka',
                housenumber: '12',
                district: 'Stare Miasto',
                city: 'Wrocław',
              },
            },
          ],
        },
      })
    );
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);
    await openNearby(page);

    await page.getByRole('combobox', { name: TEXT.nearAddress }).fill('Świdnicka 12');
    await page.getByRole('option', { name: /Świdnicka 12/ }).click();

    await expect(page).toHaveURL(/[?&]near=51\.1069%2C17\.0322(&|$)/);
    await expect(page).toHaveURL(/[?&]nearLabel=%C5%9Awidnicka\+12(&|$)/);
    await closeFilters(page);
    await expect(activeChip(page, /Świdnicka 12/)).toBeVisible();
  });

  test('a shared link restores the filter, and no card is past the radius', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?near=${RYNEK.lat},${RYNEK.lng}&radius=1500`);
    await waitForList(page);

    // Someone else's location is never called "yours".
    await expect(activeChip(page, /W promieniu 1,5\skm: Wybrany punkt/)).toBeVisible();
    for (const distance of await cardDistances(page)) {
      expect(distance).toBeLessThanOrEqual(1500);
    }
  });

  test('sorting by distance puts the nearest first', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?near=${RYNEK.lat},${RYNEK.lng}&radius=3000&sort=distance`);
    await waitForList(page);

    const distances = await cardDistances(page);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  test('the map draws the circle', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?near=${RYNEK.lat},${RYNEK.lng}&radius=2000&viewMode=map`);
    await waitForList(page);
    const countText = await page.getByText(TEXT.resultsCount).first().textContent();
    const total = Number(countText?.match(/\d+/)?.[0] ?? 0);
    test.skip(total === 0, 'Nothing within 2 km of the Rynek in this data slice');

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });
    // The circle is an SVG path in Leaflet's overlay pane.
    await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached({ timeout: 20000 });
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm exec playwright test e2e/nearby.spec.ts --project=chromium --project="Mobile Chrome"`
Expected: PASS (uses `.env.local`, which reads the dev schema).

- [ ] **Step 4: Commit**

```bash
git add e2e/nearby.spec.ts e2e/support/helpers.ts
git commit -m "test(e2e): the nearby filter, end to end"
```

---

### Task 17: Verify and ship

- [ ] **Step 1:** `pnpm lint && pnpm type-check && pnpm test` — all green (the pre-push hook runs the same).
- [ ] **Step 2:** `pnpm build` — the static export builds (it is the required `Static export build` check).
- [ ] **Step 3:** Look at it: screenshots of the panel section (desktop sidebar and the mobile drawer), the picker dialog, a filtered grid with distances, and the map with the circle.
- [ ] **Step 4:** Independent code review of the branch diff; fix what holds up.
- [ ] **Step 5:** Push `feat/proximity-filter` and open a PR against `main` describing the decisions, the measurements and the follow-ups (server-side RPC in the scraper repo if cities grow).

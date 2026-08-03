# Sorting and the Mixed First Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an order-by control (date/time, name, venue, price, each ascending or descending) and make the default an even mix of up to three events per category, so the first screen stops looking like a gym timetable.

**Architecture:** `sort` and `dir` join the query string and are applied in `buildFilteredQuery`, so the list and the map cannot disagree. `sort=mix` is the default and takes a different path: one small `limit=3` query per category in parallel, shuffled with a per-session seed, reported honestly as "a mix of N out of M".

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Vitest, Supabase/PostgREST, MUI.

**Spec:** `docs/superpowers/specs/2026-08-03-sorting-and-category-mix-design.md`

---

## File Structure

**Created:**

- `src/lib/categoryMix.ts` — the pure sampler: per-category events + seed → the mixed list. No I/O, no React.
- `src/lib/categoryMix.spec.ts`
- `src/lib/filterUtils.spec.ts` — this module has no spec today; the new parameters need one.
- `src/components/ui/SortSelect/SortSelect.tsx` — the order-by control.
- `src/components/ui/SortSelect/SortSelect.spec.tsx`

**Modified:**

- `src/types/filter.types.ts` — `SortKey`, `SortDir`, two fields on `EventFilters`.
- `src/lib/filterUtils.ts` — parse, serialise, defaults.
- `src/components/service/eventsApi.ts` — ordering in `buildFilteredQuery`; `fetchMixedEvents`.
- `src/components/service/eventsApi.spec.ts` — order-clause assertions.
- `src/components/service/queryKeys.ts` — the mix needs its own key.
- `src/components/service/useEvents.ts` — route to the mix when `sort=mix`.
- `src/i18n/messages.ts` — the control's labels and the "mix of N out of M" line.
- `src/components/views/EventsListView/EventsListView.tsx` — mount the control, show the line.

---

## Task 1: The URL contract

`sort` and `dir` behave like `viewMode` and `pageSize`: display preferences, not
filters. They survive "clear filters" and do not count towards the filter badge.

**Files:**
- Modify: `src/types/filter.types.ts`
- Modify: `src/lib/filterUtils.ts`
- Test: `src/lib/filterUtils.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/filterUtils.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/filterUtils.spec.ts`
Expected: FAIL — `sort` is not on the parsed object.

- [ ] **Step 3: Add the types**

In `src/types/filter.types.ts`:

```ts
/** How the list is ordered. `mix` is the default: a spread across categories. */
export type SortKey = 'mix' | 'date' | 'name' | 'venue' | 'price';
export type SortDir = 'asc' | 'desc';
```

and on `EventFilters`, next to `viewMode`:

```ts
  sort: SortKey;
  dir: SortDir;
```

- [ ] **Step 4: Parse and serialise**

In `src/lib/filterUtils.ts`, mirroring the existing `VALID_*` sets:

```ts
const VALID_SORTS = new Set<SortKey>(['mix', 'date', 'name', 'venue', 'price']);
const DEFAULT_SORT: SortKey = 'mix';
const DEFAULT_DIR: SortDir = 'asc';

function parseSort(value: string | null): SortKey {
  return VALID_SORTS.has(value as SortKey) ? (value as SortKey) : DEFAULT_SORT;
}

function parseDir(value: string | null): SortDir {
  return value === 'desc' ? 'desc' : DEFAULT_DIR;
}
```

Add `sort: parseSort(get('sort'))` and `dir: parseDir(get('dir'))` to the object
`parseFiltersFromParams` returns, the same two to `getDefaultFilters()`, and to
`filtersToSearchParams`:

```ts
  if (filters.sort && filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.dir && filters.dir !== DEFAULT_DIR) params.set('dir', filters.dir);
```

`countActiveFilters` is left alone — ordering is a display preference.

- [ ] **Step 5: Run it, verify it passes** — 6 tests.

- [ ] **Step 6: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/`

Adding two required fields to `EventFilters` will break every object literal
that builds one. Fix each by adding the defaults; do not widen the type to
optional — a missing sort should be a compile error, not a silent `undefined`
reaching PostgREST.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(filters): put the ordering in the URL

sort and dir behave like viewMode and pageSize — display preferences that
survive clearing the filters and stay out of the filter badge. Both are omitted
from the query string at their defaults, so existing links and saved presets
keep working and an absent sort reads as the mix.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Ordering in the query

**Files:**
- Modify: `src/components/service/eventsApi.ts`
- Test: `src/components/service/eventsApi.spec.ts`

`buildFilteredQuery` currently ends with `.order('date').order('time_start')`.
It becomes ordering-aware. Read the existing spec's builder double first — it
already spies on `order`.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/service/eventsApi.spec.ts` a describe block asserting the
order calls for each sort. Follow the file's existing style for building
`EventFilters` and reading `builder.order.mock.calls`:

- `sort: 'date'` → `order('date', { ascending: true })` then `order('time_start', { ascending: true })`.
- `sort: 'date', dir: 'desc'` → both with `{ ascending: false }`.
- `sort: 'name'` → a single `order('name', { ascending: true })`.
- `sort: 'venue'` → a single `order('venue', ...)`.
- `sort: 'price'` → `order('price', { ascending: true, nullsFirst: false })`.
- `sort: 'price', dir: 'desc'` → `order('price', { ascending: false, nullsFirst: false })` — an unknown price must not head the list in either direction.
- `sort: 'mix'` → falls back to the date ordering, because the mix is assembled by a different path and this query is still the one the map and the pool use.

- [ ] **Step 2: Run them, verify they fail**

Run: `npx vitest run src/components/service/eventsApi.spec.ts`

- [ ] **Step 3: Implement**

Replace the tail of `buildFilteredQuery`:

```ts
  return applyOrder(query, filters);
```

and add above it:

```ts
// Ordering runs in Postgres, not in the browser: the list and the map share
// this builder precisely so the two can never disagree about what "matching"
// or "first" means.
//
// `mix` has no clause of its own — it is assembled from one small query per
// category (see fetchMixedEvents) and falls back to date order here, which is
// what the map and the sampler's own queries want.
function applyOrder<T>(query: T, filters: EventFilters): T {
  const ascending = filters.dir !== 'desc';
  const builder = query as PostgrestOrderable;
  switch (filters.sort) {
    case 'name':
      return builder.order('name', { ascending }) as T;
    case 'venue':
      return builder.order('venue', { ascending }) as T;
    case 'price':
      // Nulls last in BOTH directions. An unknown price is neither the
      // cheapest nor the most expensive, and it must never head the list.
      return builder.order('price', { ascending, nullsFirst: false }) as T;
    case 'date':
    case 'mix':
    default:
      return builder
        .order('date', { ascending })
        .order('time_start', { ascending }) as T;
  }
}
```

Type `PostgrestOrderable` locally rather than reaching for `any` — eslint
forbids it. The narrowest shape that compiles is fine:

```ts
interface PostgrestOrderable {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): PostgrestOrderable;
}
```

- [ ] **Step 4: Run them, verify they pass**

- [ ] **Step 5: Full suite, typecheck, lint** — green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(events): order the query by the chosen column

Sorting happens in Postgres, in the builder the list and the map share, so the
two cannot disagree about what comes first. Price puts nulls last in both
directions — an unknown price is neither cheapest nor dearest, and heading the
list with one would be the worst of both.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The sampler, as a pure function

**Files:**
- Create: `src/lib/categoryMix.ts`
- Test: `src/lib/categoryMix.spec.ts`

Everything here is deterministic given a seed, so it is testable without a
network or a clock.

### Public surface

```ts
export const MIX_PER_CATEGORY = 3;
/** A seed that is stable for one browser session. */
export function getMixSeed(): number;
/** Interleave per-category buckets into one list, deterministic for a seed. */
export function buildCategoryMix<T>(buckets: T[][], seed: number): T[];
```

`buildCategoryMix` shuffles the order of the buckets, then round-robins across
them — so the first screen is one event from each category before any category
gets a second.

- [ ] **Step 1: Write the failing test**

Create `src/lib/categoryMix.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it, verify it fails** — module missing.

- [ ] **Step 3: Implement**

A small seeded PRNG (mulberry32 or equivalent, written out — no dependency),
`getMixSeed` reading/writing `go-to-city.mixSeed` in `sessionStorage` inside
try/catch with a random fallback, and `buildCategoryMix` doing a seeded
Fisher–Yates on a copy of the bucket order followed by a round-robin drain.

- [ ] **Step 4: Run it, verify it passes** — 9 tests.

- [ ] **Step 5: Full suite, typecheck, lint** — green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/categoryMix.ts src/lib/categoryMix.spec.ts
git commit -m "feat(events): a seeded category sampler

Round-robins across categories so the first screen is one event from each
before any category gets a second — the whole point, since 519 of 748 events
are gym classes and cinema screenings and date order buries everything else.

The seed lives for one session: reshuffling per render would make the page
jitter, and reshuffling per navigation would make going back show a different
list.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Fetching the mix

**Files:**
- Modify: `src/components/service/eventsApi.ts`
- Modify: `src/components/service/queryKeys.ts`
- Modify: `src/components/service/useEvents.ts`
- Test: `src/components/service/eventsApi.spec.ts`

### `fetchMixedEvents`

```ts
export async function fetchMixedEvents(
  cityId: CityId | string,
  filters: EventFilters,
  categoryFilter: ResolvedCategoryFilter,
  categoryMains: string[],
  seed: number
): Promise<{ events: Event[]; total: number; poolTotal: number }>
```

- Runs one `buildFilteredQuery` per entry in `categoryMains`, each narrowed with
  `.eq('category_main', main)` and `.limit(MIX_PER_CATEGORY)`, all in
  `Promise.allSettled` — **a rejected category is dropped, not fatal.** One dead
  category must not blank the page.
- `poolTotal` is the true number of matching events, read from the `count` of
  any one of those queries — PostgREST returns the unrestricted count in
  `Content-Range` regardless of `limit`. If that proves unreliable, issue one
  extra `head: true` count query; it transfers no rows.
- `total` is the mixed list's own length.
- Applies `applyClientFilters` for `freeOnly`, as the other fetchers do, then
  `buildCategoryMix`, then slices the page with the caller's `page`/`pageSize`.

### Routing

In `useEvents`, `sort === 'mix'` selects this path — **except** when
`filters.search` is set, where it falls back to `date`: a search is a precise
question and sampling three per category would hide most of the answers.

`categoryMains` comes from `useCategories().topLevel` mapped to `display_name`,
narrowed to the selected categories' mains when the user has filtered. The mix
cannot run before the categories have loaded, so the existing `ready` gate
extends to cover it.

`queryKeys` gains `mix(cityId, filters, seed)` so the mixed list caches
separately from the ordinary one.

`useEvents` returns `poolTotal` alongside `total` so the view can say "a mix of
N out of M".

- [ ] **Step 1: Write the failing tests**

In `eventsApi.spec.ts`: one query per category each limited to 3; a rejected
category is dropped and the rest still return; the returned `total` is the
mixed length while `poolTotal` is the unrestricted count; paging slices the
mixed list.

- [ ] **Step 2: Run them, verify they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them, verify they pass.**

- [ ] **Step 5: Full suite, typecheck, lint** — green, no existing test edited.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(events): assemble the default list from a per-category sample

One limit=3 query per category in parallel — about 36 rows — rather than the
1.5 MB the whole result set costs, which was measured and rejected for the
first paint of the most common page. A category whose query fails is dropped;
one dead category must not blank the list.

A text search opts out: sampling three per category would hide most of the
answers to a precise question.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: The control, and saying what the mix is

**Files:**
- Create: `src/components/ui/SortSelect/SortSelect.tsx`
- Create: `src/components/ui/SortSelect/SortSelect.spec.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/components/views/EventsListView/EventsListView.tsx`

### The control

A `Select` in the results header, beside the existing page-size `Select` and
`ViewToggle` — follow their styling exactly. Options: mix, date, name, venue,
price. Beside it, an icon button toggling ascending/descending, disabled under
`mix` where direction has no meaning. Both write through `updateFilters`, which
already resets to page 1.

### The messages

New keys in **both** `pl` and `en` tables (`satisfies Messages` fails the build
on a missing one): the control's label, the five option labels, the direction
toggle's two accessible names, and the mix line.

The mix line follows the existing `MAP_SHOWN_OF_TOTAL` precedent — the map
already says "showing N of M" for exactly this reason — e.g.
`SORT_MIX_SUMMARY: (shown: number, total: number) => …`.

### The view

`EventsListView` renders the control and, under `sort === 'mix'`, replaces the
plain count with the mix line. Every other sort keeps today's count.

- [ ] **Step 1: Write the failing test**

`SortSelect.spec.tsx`: renders the five options; choosing one calls `onChange`
with that key; the direction button is disabled under `mix` and enabled
otherwise; an axe pass with no violations (follow `FilterPanel.spec.tsx`).

- [ ] **Step 2: Run it, verify it fails.**

- [ ] **Step 3: Implement the control and the messages.**

- [ ] **Step 4: Run it, verify it passes.**

- [ ] **Step 5: Wire it into `EventsListView` and show the mix line.**

- [ ] **Step 6: Full suite, typecheck, lint, and a build**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/ && pnpm build`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(events): an order-by control, and an honest label for the mix

The default list is a sample, so it reports itself as one — \"a mix of N out of
M\" rather than a count that would read as a bug next to 748. That is the same
thing the map already does when it can only place some of the results.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- Tasks are ordered: 2 and 3 need 1; 4 needs 2 and 3; 5 needs 4.
- Task 1 will break every literal that constructs `EventFilters`. Fix them by
  adding the defaults, never by making the fields optional.
- No existing test may be edited except `eventsApi.spec.ts`, and there only by
  addition — its current assertions describe behaviour that must not change.

# Multi-City SEO Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-city event browser into a multi-city static site with SEO-first per-city URLs (`/{city}/{category}/{name}-{shortid}`), launching Wrocław alongside Szczecin.

**Architecture:** Next.js `output: 'export'`. City comes from the URL segment. Per-city event data from per-city Supabase projects; filter categories always from Szczecin. Event detail/hub/landing pages are statically generated; the filterable list is client-rendered. Permalinks derive from the stable `event_key` (numeric ids churn daily). Unbuilt/stale URLs fall to a graceful timed-redirect 404.

**Tech Stack:** Next.js 16 (App Router, static export), React 19, MUI, @tanstack/react-query, @supabase/supabase-js, Vitest + Testing Library, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-07-14-multi-city-seo-routing-design.md`

---

## File structure map

**New files**
- `src/lib/slug.ts` — pure slug/permalink helpers (`nameSlug`, `shortId`, `buildCategorySlugMap`, `resolveCategorySlug`, `eventPath`).
- `src/lib/slug.spec.ts` — unit tests for the above.
- `src/config/CityRouteProvider.tsx` — bridges the `[city]` route param into `CityProvider`.
- `src/app/[city]/layout.tsx` — validates the city segment, sets `dynamicParams=false`, provides the city.
- `src/app/[city]/page.tsx` — city landing (wraps `HomeView`).
- `src/app/[city]/wydarzenia/page.tsx` — filterable list (wraps `EventsListView`).
- `src/app/[city]/[category]/page.tsx` — category hub (static).
- `src/app/[city]/[category]/[event]/page.tsx` — event detail (static).
- `src/app/[city]/[category]/[event]/not-found.tsx` — city-scoped graceful not-found.
- `src/components/views/CityPickerView/CityPickerView.tsx` — fullscreen picker at `/`.
- `src/components/views/CategoryHubView/CategoryHubView.tsx` — category hub UI.
- `src/components/common/NotFoundRedirect/NotFoundRedirect.tsx` — reusable timed-redirect UI.

**Modified files**
- `src/config/cities.ts` — Wrocław available + ordering + `CATEGORIES_CITY_ID`.
- `src/config/CityProvider.tsx` — accept an initial city id (URL-driven).
- `src/components/service/eventsApi.ts` — add `getCityEvents`, pin `fetchCategories`, map `eventKey`.
- `src/components/service/eventsApi.spec.ts` — update for `fetchCategories()` + `eventKey`.
- `src/components/service/queryKeys.ts` — global categories key.
- `src/components/service/useCategories.ts` — `fetchCategories()` (no city) + `displayNameToSlug`.
- `src/types/event.types.ts` — add `eventKey` to `Event`.
- `src/components/common/EventCard/EventCard.tsx` + `EventRow/EventRow.tsx` — link via `eventPath`.
- `src/components/views/EventsListView/EventsListView.tsx` + `FilterPanel/FilterPanel.tsx` — navigate to `/{city}/wydarzenia`.
- `src/components/views/HomeView/HomeView.tsx` — city-aware tile/CTA links.
- `src/lib/homeFilters.ts` — builders take a `citySlug`.
- `src/components/common/AppHeader/AppHeader.tsx` + `CitySwitcher.tsx` — city-aware nav.
- `src/app/not-found.tsx` — use `NotFoundRedirect`.
- `src/app/sitemap.ts` — per-city routes + hubs + permalinks.
- `src/i18n/messages.ts` — new keys (pl/en).
- `next.config.js` — `trailingSlash: true`.
- `.env.local`, `.github/workflows/deploy.yml`, `.github/workflows/e2e.yml` — Wrocław env.
- e2e specs + `e2e/support/helpers.ts` — new routes.

**Removed**
- `src/app/events/` (page, loading, error, `[id]/*`).

---

## Task 1: Wrocław city config + shared-categories constant

**Files:**
- Modify: `src/config/cities.ts`

- [ ] **Step 1: Reorder `CITY_DEFS` so Wrocław is first and add the shared-categories constant**

In `src/config/cities.ts`, move the `wroclaw` object to the top of `CITY_DEFS` (before `szczecin`). Add after the `DEFAULT_CITY_ID` export:

```ts
// Every city's filter categories are sourced from this one project. Per-city
// Supabase projects hold events only; the taxonomy lives in Szczecin. This is a
// deliberate architectural inconsistency (see the multi-city design spec).
export const CATEGORIES_CITY_ID: CityId = 'szczecin';
```

- [ ] **Step 2: Type-check**

Run: `corepack pnpm@10 type-check`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/config/cities.ts
git commit -m "feat(cities): pin shared categories to Szczecin, order Wrocław first"
```

---

## Task 2: Slug + permalink helpers (pure, TDD)

**Files:**
- Create: `src/lib/slug.ts`
- Test: `src/lib/slug.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/slug.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `corepack pnpm@10 exec vitest run src/lib/slug.spec.ts`
Expected: FAIL ("Cannot find module './slug'").

- [ ] **Step 3: Implement `src/lib/slug.ts`**

```ts
import type { Event } from '@/types/event.types';

export const CATEGORY_FALLBACK_SLUG = 'inne';
const MAX_NAME_SLUG_LEN = 60;

const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
};

/** URL-safe slug from an event name: fold Polish diacritics, hyphenate, cap length. */
export function nameSlug(name: string): string {
  const folded = (name ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_SLUG_LEN)
    .replace(/-+$/g, '');
  return slug || 'wydarzenie';
}

/** Stable 8-hex-char id derived from the immutable event_key (FNV-1a 32-bit). */
export function shortId(eventKey: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < eventKey.length; i++) {
    hash ^= eventKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

interface CategoryLike {
  slug: string;
  parent_slug: string | null;
  display_name: string;
}

/** Map top-level category display_name -> slug (events store display_name text). */
export function buildCategorySlugMap(categories: readonly CategoryLike[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) {
    if (c.parent_slug === null) map.set(c.display_name, c.slug);
  }
  return map;
}

/** Category slug for an event's category_main; unknown/blank -> fallback ("inne"). */
export function resolveCategorySlug(categoryMain: string, slugMap: Map<string, string>): string {
  return slugMap.get(categoryMain) ?? CATEGORY_FALLBACK_SLUG;
}

/** Canonical event permalink: /{city}/{category}/{name}-{shortid}. */
export function eventPath(citySlug: string, event: Event, slugMap: Map<string, string>): string {
  const category = resolveCategorySlug(event.categoryMain, slugMap);
  return `/${citySlug}/${category}/${nameSlug(event.name)}-${shortId(event.eventKey)}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `corepack pnpm@10 exec vitest run src/lib/slug.spec.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/slug.spec.ts
git commit -m "feat(slug): stable event permalink + category slug helpers"
```

---

## Task 3: Event type gains `eventKey`; eventsApi adds `getCityEvents` + pins categories

**Files:**
- Modify: `src/types/event.types.ts`
- Modify: `src/components/service/eventsApi.ts`
- Modify: `src/components/service/eventsApi.spec.ts`
- Modify: `src/components/service/queryKeys.ts`
- Modify: `src/components/service/useCategories.ts`

- [ ] **Step 1: Add `eventKey` to the Event type**

In `src/types/event.types.ts`, add to `interface Event` (right after `id: string;`):

```ts
  eventKey: string;          // immutable natural key (event_key); source of the permalink id
```

- [ ] **Step 2: Update failing eventsApi tests first**

In `src/components/service/eventsApi.spec.ts`:

(a) In the "maps a db row into the domain Event shape" test, add `eventKey: 'evt-101',` to the expected object (the default `makeRow` sets `event_key: 'evt-101'`), right after `id: '101',`.

(b) Replace the three `fetchCategories('szczecin')` calls with `fetchCategories()` (no argument).

- [ ] **Step 3: Run to verify failure**

Run: `corepack pnpm@10 exec vitest run src/components/service/eventsApi.spec.ts`
Expected: FAIL (type error on `fetchCategories()` arity + missing `eventKey`).

- [ ] **Step 4: Map `eventKey`, add `getCityEvents`, pin `fetchCategories`**

In `src/components/service/eventsApi.ts`:

(a) In `mapRow`, add to the returned object (after `id: String(row.id),`):

```ts
    eventKey: row.event_key,
```

(b) Update the cities import and replace `fetchCategories`:

```ts
import { CityId, getCity, CATEGORIES_CITY_ID } from '@/config/cities';
// ...
export async function fetchCategories(): Promise<DbCategory[]> {
  const supabase = getSupabaseForCity(CATEGORIES_CITY_ID);
  const { data, error } = await supabase
    .from('categories')
    .select('slug, parent_slug, display_name, display_plural, icon, color, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new ServerError(error.message);
  return (data ?? []) as DbCategory[];
}
```

(c) Append a build-time, module-memoized fetch-all:

```ts
// Build-time cache: one fetch-all per city per build process. Shared by
// generateStaticParams and every static detail/hub page so we never refetch.
const cityEventsCache = new Map<string, Promise<Event[]>>();

export function getCityEvents(cityId: CityId | string): Promise<Event[]> {
  const city = getCity(cityId);
  const cached = cityEventsCache.get(city.id);
  if (cached) return cached;
  const promise = (async () => {
    const supabase = getSupabaseForCity(city.id);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date')
      .order('time_start');
    if (error) throw new ServerError(error.message);
    const cityName = city.displayName.pl;
    return (data as SupabaseEventRow[] ?? []).map((row) => mapRow(row, cityName));
  })();
  cityEventsCache.set(city.id, promise);
  return promise;
}
```

- [ ] **Step 5: Global categories key + city-free hook + slug map**

In `src/components/service/queryKeys.ts`, replace the `categories` entry:

```ts
  categories: () => ['categories'] as const,
```

In `src/components/service/useCategories.ts`:
- change the query to `queryKey: eventsKeys.categories(), queryFn: () => fetchCategories()` and remove the `useCity` import/usage;
- add and return a derived map:

```ts
  const displayNameToSlug = useMemo(
    () => new Map(topLevel.map((c) => [c.display_name, c.slug])),
    [topLevel]
  );
  // add `displayNameToSlug` to the returned object
```

- [ ] **Step 6: Run service + slug tests**

Run: `corepack pnpm@10 exec vitest run src/components/service/eventsApi.spec.ts src/lib/slug.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/event.types.ts src/components/service/
git commit -m "feat(data): eventKey mapping, getCityEvents build cache, shared categories"
```

---

## Task 4: next.config trailingSlash + remove old /events routes

**Files:**
- Modify: `next.config.js`
- Delete: `src/app/events/` (entire directory)

- [ ] **Step 1: Add trailingSlash**

In `next.config.js`, add `trailingSlash: true,` inside `nextConfig` (below `output: 'export'`).

- [ ] **Step 2: Remove the old routes**

Run: `git rm -r src/app/events`

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(routing): trailingSlash for static hosting; drop /events routes"
```

(The app will not build cleanly until the new routes exist — expected; later tasks add them. Do not run `build` yet.)

---

## Task 5: URL-driven CityProvider + `[city]` layout

**Files:**
- Modify: `src/config/CityProvider.tsx`
- Create: `src/config/CityRouteProvider.tsx`
- Create: `src/app/[city]/layout.tsx`

- [ ] **Step 1: Let CityProvider accept an initial city**

In `src/config/CityProvider.tsx`, change the signature and initial state:

```tsx
export function CityProvider({
  children,
  initialCityId,
}: {
  children: React.ReactNode;
  initialCityId?: CityId;
}) {
  const [cityId, setCityId] = useState<CityId>(initialCityId ?? DEFAULT_CITY_ID);
```

Guard the resolution effect so an explicit URL city wins and skips geo/localStorage:

```tsx
  useEffect(() => {
    if (initialCityId) {
      setIsResolved(true);
      return;
    }
    // ...existing localStorage + geolocation resolution unchanged...
  }, [initialCityId]);
```

- [ ] **Step 2: Create the route→provider bridge**

Create `src/config/CityRouteProvider.tsx`:

```tsx
'use client';

import { CityProvider } from './CityProvider';
import { CityId } from './cities';

export default function CityRouteProvider({
  cityId,
  children,
}: {
  cityId: CityId;
  children: React.ReactNode;
}) {
  return <CityProvider initialCityId={cityId}>{children}</CityProvider>;
}
```

- [ ] **Step 3: Create `src/app/[city]/layout.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { AVAILABLE_CITIES, isCityId, getCity } from '@/config/cities';
import CityRouteProvider from '@/config/CityRouteProvider';

export const dynamicParams = false;

export function generateStaticParams() {
  return AVAILABLE_CITIES.map((c) => ({ city: c.id }));
}

interface CityLayoutProps {
  children: React.ReactNode;
  params: Promise<Readonly<{ city: string }>>;
}

export default async function CityLayout({ children, params }: CityLayoutProps) {
  const { city } = await params;
  if (!isCityId(city) || !getCity(city).available) notFound();
  return <CityRouteProvider cityId={city}>{children}</CityRouteProvider>;
}
```

Note: `Providers` already wraps a top-level `CityProvider`; the nested one here overrides context for the city subtree (nearest-provider-wins), so `providers.tsx` needs no change.

- [ ] **Step 4: Type-check**

Run: `corepack pnpm@10 type-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/config/CityProvider.tsx src/config/CityRouteProvider.tsx "src/app/[city]/layout.tsx"
git commit -m "feat(routing): URL-driven city context via [city] layout"
```

---

## Task 6: Root city picker (`/`)

**Files:**
- Create: `src/components/views/CityPickerView/CityPickerView.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `CityPickerView`**

```tsx
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PlaceIcon from '@mui/icons-material/Place';
import { AVAILABLE_CITIES } from '@/config/cities';
import { useTranslation } from '@/i18n';

export default function CityPickerView() {
  const { t, locale } = useTranslation();
  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 3,
        gap: 4,
      }}
    >
      <Box>
        <Typography variant="h3" component="h1" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {t.CITY_PICKER_TITLE}
        </Typography>
        <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mt: 1 }}>
          {t.CITY_PICKER_SUBTITLE}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
        {AVAILABLE_CITIES.map((city) => (
          <Link key={city.id} href={`/${city.id}` as Route} style={{ textDecoration: 'none' }}>
            <Box
              sx={{
                minWidth: 200,
                p: 3,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-elevated)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'var(--color-accent-primary)' },
              }}
            >
              <PlaceIcon sx={{ color: 'var(--color-accent-primary)' }} />
              <Typography variant="h6" sx={{ color: 'var(--color-text-primary)' }}>
                {city.displayName[locale]}
              </Typography>
            </Box>
          </Link>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import CityPickerView from '@/components/views/CityPickerView/CityPickerView';

export default function HomePage() {
  return <CityPickerView />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/views/CityPickerView/ src/app/page.tsx
git commit -m "feat(routing): fullscreen city picker at /"
```

---

## Task 7: City landing (`/{city}`) — HomeView rewire

**Files:**
- Modify: `src/lib/homeFilters.ts`
- Modify: `src/lib/homeFilters.spec.ts`
- Modify: `src/components/views/HomeView/HomeView.tsx`
- Create: `src/app/[city]/page.tsx`

- [ ] **Step 1: Make homeFilters city-aware**

In `src/lib/homeFilters.ts`, add a `citySlug` first parameter to every `build*Url` function and to `buildInterestUrl`, and change every `` return `/events?${params.toString()}` `` to:

```ts
  return `/${citySlug}/wydarzenia?${params.toString()}`;
```

Example: `export function buildNowUrl(citySlug: string, now: Date): string`. Update `buildInterestUrl(citySlug: string, now: Date, categories: string[])` and its three callers (`buildArtUrl`, `buildFoodUrl`, `buildDanceUrl`) to thread `citySlug`.

- [ ] **Step 2: Update `homeFilters.spec.ts`**

In `src/lib/homeFilters.spec.ts`, change each `build*Url(now)` call to `build*Url('wroclaw', now)`. Where a test inspects the path, assert `url.startsWith('/wroclaw/wydarzenia')`.

- [ ] **Step 3: Rewire HomeView links to the current city**

In `src/components/views/HomeView/HomeView.tsx` (which already reads `const { city } = useCity();`):
- replace `const FALLBACK_HREF = '/events' as Route;` usages so the fallback is `` `/${city.id}/wydarzenia` as Route ``; move the constant into the component or derive `const listHref = \`/${city.id}/wydarzenia\` as Route;` and use it for all `urls` fallbacks.
- every `build*Url(now)` call → `build*Url(city.id, now)`.
- map section `href={'/events?viewMode=map' as Route}` → `` `/${city.id}/wydarzenia?viewMode=map` as Route ``.
- browse-all button `href={'/events' as Route}` → `` `/${city.id}/wydarzenia` as Route ``.

- [ ] **Step 4: Create `src/app/[city]/page.tsx`**

```tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import HomeView from '@/components/views/HomeView/HomeView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';

interface CityPageProps {
  params: Promise<Readonly<{ city: string }>>;
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityId = isCityId(city) ? city : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  return {
    title: messages[DEFAULT_LOCALE].META_EVENTS_TITLE(locative),
    description: messages[DEFAULT_LOCALE].META_DESCRIPTION(locative),
  };
}

export default function CityLandingPage() {
  return (
    <Suspense fallback={null}>
      <HomeView />
    </Suspense>
  );
}
```

- [ ] **Step 5: Run unit tests**

Run: `corepack pnpm@10 exec vitest run src/lib/homeFilters.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/homeFilters.ts src/lib/homeFilters.spec.ts src/components/views/HomeView/ "src/app/[city]/page.tsx"
git commit -m "feat(routing): city landing page with city-aware home links"
```

---

## Task 8: Filterable list (`/{city}/wydarzenia`) + card links

**Files:**
- Modify: `src/components/common/EventCard/EventCard.tsx`
- Modify: `src/components/common/EventRow/EventRow.tsx`
- Modify: `src/components/views/EventsListView/EventsListView.tsx`
- Modify: `src/components/common/FilterPanel/FilterPanel.tsx`
- Create: `src/app/[city]/wydarzenia/page.tsx`

- [ ] **Step 1: Link cards via `eventPath`**

In `EventCard.tsx`: add imports `import { useCity } from '@/config/CityProvider';`, `import { eventPath } from '@/lib/slug';`, `import type { Route } from 'next';`. At the top of the component add `const { city } = useCity();` and `const { displayNameToSlug } = useCategories();` (call `useCategories` at top level; it is currently only used inside `ImageWrapper`). Compute and use the href:

```tsx
  const href = eventPath(city.id, event, displayNameToSlug);
  // ...
  <Link href={href as Route} className={styles.link}>
```

Apply the identical change in `EventRow.tsx` (currently links to `/events/${event.id}`).

- [ ] **Step 2: Point list navigation at the city route**

In `EventsListView.tsx`, change the `navigate` callback:

```tsx
router.push(`/events?${params.toString()}`);
```
to
```tsx
router.push(`/${city.id}/wydarzenia?${params.toString()}`);
```

(`city` is already in scope via `useCity()`.) In `FilterPanel.tsx`, add `import { useCity } from '@/config/CityProvider';`, read `const { city } = useCity();`, and change both `router.push(\`/events?...\`)` calls to `` `/${city.id}/wydarzenia?...` ``.

- [ ] **Step 3: Create `src/app/[city]/wydarzenia/page.tsx`**

```tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import EventsListView from '@/components/views/EventsListView/EventsListView';
import { messages, DEFAULT_LOCALE } from '@/i18n';
import { getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';

interface ListPageProps {
  params: Promise<Readonly<{ city: string }>>;
}

export async function generateMetadata({ params }: ListPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityId = isCityId(city) ? city : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  return { title: messages[DEFAULT_LOCALE].META_EVENTS_TITLE(locative) };
}

export default function CityEventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsListView />
    </Suspense>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `corepack pnpm@10 type-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ "src/app/[city]/wydarzenia/"
git commit -m "feat(routing): filterable list at /{city}/wydarzenia; eventPath card links"
```

---

## Task 9: Category hub (`/{city}/{category}`)

**Files:**
- Create: `src/components/views/CategoryHubView/CategoryHubView.tsx`
- Create: `src/app/[city]/[category]/page.tsx`

- [ ] **Step 1: Create `CategoryHubView`**

```tsx
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import EventGrid from '@/components/common/EventGrid/EventGrid';
import { Event } from '@/types/event.types';
import { useTranslation } from '@/i18n';

interface CategoryHubViewProps {
  citySlug: string;
  categorySlug: string;
  categoryName: string;
  events: Event[];
}

export default function CategoryHubView({ citySlug, categorySlug, categoryName, events }: CategoryHubViewProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, mb: 1 }}>
        {categoryName}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
        {t.CATEGORY_HUB_INTRO(categoryName)}
      </Typography>
      <EventGrid events={events} />
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          component={Link}
          href={`/${citySlug}/wydarzenia?categories=${categorySlug}` as Route}
          variant="outlined"
        >
          {t.CATEGORY_HUB_SEE_ALL}
        </Button>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Create `src/app/[city]/[category]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCityEvents, fetchCategories } from '@/components/service/eventsApi';
import { buildCategorySlugMap, resolveCategorySlug } from '@/lib/slug';
import { AVAILABLE_CITIES, getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';
import CategoryHubView from '@/components/views/CategoryHubView/CategoryHubView';
import { messages, DEFAULT_LOCALE } from '@/i18n';

export const dynamicParams = false;
const HUB_LIMIT = 48;

async function slugMap() {
  return buildCategorySlugMap(await fetchCategories());
}

async function categoryName(categorySlug: string): Promise<string> {
  const cats = await fetchCategories();
  return cats.find((c) => c.slug === categorySlug && c.parent_slug === null)?.display_name ?? categorySlug;
}

export async function generateStaticParams() {
  const map = await slugMap();
  const params: Array<{ city: string; category: string }> = [];
  for (const city of AVAILABLE_CITIES) {
    const events = await getCityEvents(city.id);
    const slugs = new Set(events.map((e) => resolveCategorySlug(e.categoryMain, map)));
    for (const category of slugs) params.push({ city: city.id, category });
  }
  return params;
}

interface HubProps {
  params: Promise<Readonly<{ city: string; category: string }>>;
}

export async function generateMetadata({ params }: HubProps): Promise<Metadata> {
  const { city, category } = await params;
  const cityId = isCityId(city) ? city : DEFAULT_CITY_ID;
  const locative = getCity(cityId).locativeForm[DEFAULT_LOCALE];
  const name = await categoryName(category);
  return {
    title: `${name} — ${messages[DEFAULT_LOCALE].META_EVENTS_TITLE(locative)}`,
    description: messages[DEFAULT_LOCALE].META_DESCRIPTION(locative),
  };
}

export default async function CategoryHubPage({ params }: HubProps) {
  const { city, category } = await params;
  if (!isCityId(city)) notFound();
  const map = await slugMap();
  const events = (await getCityEvents(city)).filter(
    (e) => resolveCategorySlug(e.categoryMain, map) === category
  );
  if (events.length === 0) notFound();
  return (
    <CategoryHubView
      citySlug={city}
      categorySlug={category}
      categoryName={await categoryName(category)}
      events={events.slice(0, HUB_LIMIT)}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/views/CategoryHubView/ "src/app/[city]/[category]/page.tsx"
git commit -m "feat(routing): static category hub pages"
```

---

## Task 10: Event detail + city-scoped not-found

**Files:**
- Create: `src/components/common/NotFoundRedirect/NotFoundRedirect.tsx`
- Create: `src/app/[city]/[category]/[event]/not-found.tsx`
- Create: `src/app/[city]/[category]/[event]/page.tsx`

- [ ] **Step 1: Create `NotFoundRedirect` (city-aware; reused by both 404 surfaces)**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { isCityId } from '@/config/cities';
import { useTranslation } from '@/i18n';

const SECONDS = 6;

// redirectTo === '/' means "decide from the path": if it starts with a valid
// city, send to that city's search; otherwise to the picker.
export default function NotFoundRedirect({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [left, setLeft] = useState(SECONDS);

  const firstSeg = pathname.split('/').filter(Boolean)[0];
  const target = redirectTo === '/' && isCityId(firstSeg) ? `/${firstSeg}/wydarzenia` : redirectTo;

  useEffect(() => {
    const tick = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const go = window.setTimeout(() => router.push(target as Route), SECONDS * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(go);
    };
  }, [router, target]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', px: 3 }}>
      <Typography variant="h1" sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: '4rem', md: '6rem' }, color: 'var(--color-accent-primary)', mb: 2 }}>
        404
      </Typography>
      <Typography variant="h5" sx={{ color: 'var(--color-text-primary)', mb: 1 }}>
        {t.NOTFOUND_TITLE}
      </Typography>
      <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
        {t.NOTFOUND_BODY}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-muted)', mb: 3 }} role="status" aria-live="polite">
        {t.NOTFOUND_REDIRECT(left)}
      </Typography>
      <Button component="a" href={target} variant="contained" color="primary" sx={{ minHeight: 44 }}>
        {t.NOTFOUND_CTA}
      </Button>
    </Box>
  );
}
```

- [ ] **Step 2: Create the city-scoped not-found**

`src/app/[city]/[category]/[event]/not-found.tsx`:

```tsx
import NotFoundRedirect from '@/components/common/NotFoundRedirect/NotFoundRedirect';

export default function EventNotFound() {
  return <NotFoundRedirect />;
}
```

- [ ] **Step 3: Create the detail page**

`src/app/[city]/[category]/[event]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCityEvents, fetchCategories } from '@/components/service/eventsApi';
import { buildCategorySlugMap, resolveCategorySlug, shortId, nameSlug } from '@/lib/slug';
import { AVAILABLE_CITIES, getCity, isCityId, DEFAULT_CITY_ID } from '@/config/cities';
import EventDetailView from '@/components/views/EventDetailView/EventDetailView';
import { Event } from '@/types/event.types';

export const dynamicParams = false;

function idFromSlug(slug: string): string {
  return slug.slice(slug.lastIndexOf('-') + 1);
}

async function resolveEvent(cityId: string, eventSlug: string): Promise<Event | null> {
  const id = idFromSlug(eventSlug);
  const events = await getCityEvents(cityId);
  return events.find((e) => shortId(e.eventKey) === id) ?? null;
}

export async function generateStaticParams() {
  const map = buildCategorySlugMap(await fetchCategories());
  const params: Array<{ city: string; category: string; event: string }> = [];
  for (const city of AVAILABLE_CITIES) {
    for (const e of await getCityEvents(city.id)) {
      params.push({
        city: city.id,
        category: resolveCategorySlug(e.categoryMain, map),
        event: `${nameSlug(e.name)}-${shortId(e.eventKey)}`,
      });
    }
  }
  return params;
}

interface DetailProps {
  params: Promise<Readonly<{ city: string; category: string; event: string }>>;
}

export async function generateMetadata({ params }: DetailProps): Promise<Metadata> {
  const { city, event } = await params;
  if (!isCityId(city)) return { title: 'Wydarzenie nie znalezione' };
  const found = await resolveEvent(city, event);
  if (!found) return { title: 'Wydarzenie nie znalezione' };
  return { title: `${found.name} — ${found.date}`, description: found.description.slice(0, 160) };
}

export default async function EventDetailPage({ params }: DetailProps) {
  const { city, event } = await params;
  if (!isCityId(city)) notFound();
  const found = await resolveEvent(city, event);
  if (!found) notFound();

  const cityName = getCity(isCityId(city) ? city : DEFAULT_CITY_ID).displayName.pl;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: found.name,
    description: found.description,
    ...(found.imageUrl && { image: found.imageUrl }),
    startDate: `${found.date}T${found.startTime}:00`,
    ...(found.endTime && { endDate: `${found.date}T${found.endTime}:00` }),
    location: {
      '@type': 'Place',
      name: found.location.name,
      address: { '@type': 'PostalAddress', addressLocality: cityName },
    },
    ...(found.price.amount !== null && {
      offers: { '@type': 'Offer', price: found.price.amount, priceCurrency: found.price.currency },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escape '<' so an event name containing "</script>" cannot break out of
        // the inline JSON-LD block (XSS-safe serialization of trusted data).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <EventDetailView event={found} />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/common/NotFoundRedirect/ "src/app/[city]/[category]/[event]/"
git commit -m "feat(routing): static event detail with stable-id resolution + graceful 404"
```

---

## Task 11: Global not-found (404.html)

**Files:**
- Modify: `src/app/not-found.tsx`

- [ ] **Step 1: Replace `src/app/not-found.tsx`**

```tsx
import NotFoundRedirect from '@/components/common/NotFoundRedirect/NotFoundRedirect';

// Emitted as 404.html by the static export. NotFoundRedirect reads the current
// path client-side and sends the user to /{city}/wydarzenia when the URL starts
// with a valid city, otherwise to the city picker.
export default function NotFound() {
  return <NotFoundRedirect />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/not-found.tsx
git commit -m "feat(404): graceful timed-redirect not-found page"
```

---

## Task 12: i18n keys for the new surfaces

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: Add keys to the `pl` table**

```ts
  CITY_PICKER_TITLE: 'Wybierz swoje miasto',
  CITY_PICKER_SUBTITLE: 'Zobacz, co się dzieje w Twojej okolicy',
  CATEGORY_HUB_INTRO: (category: string) => `Nadchodzące wydarzenia z kategorii ${category}.`,
  CATEGORY_HUB_SEE_ALL: 'Zobacz wszystkie i filtruj',
  NOTFOUND_TITLE: 'Nie znaleziono strony',
  NOTFOUND_BODY: 'Ta strona nie istnieje lub wydarzenie się już zakończyło.',
  NOTFOUND_REDIRECT: (s: number) => `Przekierujemy Cię do wyszukiwania za ${s} s…`,
  NOTFOUND_CTA: 'Szukaj wydarzeń',
```

- [ ] **Step 2: Add the matching keys to the `en` table**

```ts
  CITY_PICKER_TITLE: 'Choose your city',
  CITY_PICKER_SUBTITLE: 'See what is happening near you',
  CATEGORY_HUB_INTRO: (category: string) => `Upcoming ${category} events.`,
  CATEGORY_HUB_SEE_ALL: 'See all and filter',
  NOTFOUND_TITLE: 'Page not found',
  NOTFOUND_BODY: 'This page does not exist or the event has already ended.',
  NOTFOUND_REDIRECT: (s: number) => `Redirecting you to search in ${s}s…`,
  NOTFOUND_CTA: 'Search events',
```

- [ ] **Step 3: Type-check (verifies pl/en parity via `satisfies Messages`)**

Run: `corepack pnpm@10 type-check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(i18n): city picker, category hub and not-found copy (pl/en)"
```

---

## Task 13: Header city-aware navigation

**Files:**
- Modify: `src/components/common/AppHeader/AppHeader.tsx`
- Modify: `src/components/common/AppHeader/CitySwitcher.tsx`

- [ ] **Step 1: City-aware nav items**

In `AppHeader.tsx`, add `import { useCity } from '@/config/CityProvider';`, read `const { city } = useCity();`, and change `navItems`:

```tsx
  const navItems = [
    { label: t.NAV_HOME, href: `/${city.id}` as const },
    { label: t.NAV_EVENTS, href: `/${city.id}/wydarzenia` as const },
  ];
```

The brand logo `Link href="/"` stays (it returns to the city picker).

- [ ] **Step 2: City switch navigates to the target city's landing**

In `CitySwitcher.tsx`, add `import { useRouter } from 'next/navigation';` and `import type { Route } from 'next';`. In the component: `const router = useRouter();`. Update `handleSelect`:

```tsx
  const handleSelect = (id: CityId) => {
    setCity(id);
    setAnchorEl(null);
    router.push(`/${id}` as Route);
  };
```

- [ ] **Step 3: Type-check + commit**

Run: `corepack pnpm@10 type-check`
Expected: exit 0.

```bash
git add src/components/common/AppHeader/
git commit -m "feat(nav): city-aware header nav and city switch routing"
```

---

## Task 14: SEO — sitemap rebuild

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Replace `src/app/sitemap.ts`**

```ts
import { MetadataRoute } from 'next';
import { AVAILABLE_CITIES } from '@/config/cities';
import { SITE_URL } from '@/config/site';
import { getCityEvents, fetchCategories } from '@/components/service/eventsApi';
import { buildCategorySlugMap, resolveCategorySlug, eventPath } from '@/lib/slug';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const map = buildCategorySlugMap(await fetchCategories());

  const routes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: 'daily', priority: 1 },
  ];

  for (const city of AVAILABLE_CITIES) {
    routes.push({ url: `${SITE_URL}/${city.id}`, lastModified, changeFrequency: 'daily', priority: 0.9 });
    routes.push({ url: `${SITE_URL}/${city.id}/wydarzenia`, lastModified, changeFrequency: 'daily', priority: 0.8 });

    const events = await getCityEvents(city.id);
    const hubSlugs = new Set(events.map((e) => resolveCategorySlug(e.categoryMain, map)));
    for (const slug of hubSlugs) {
      routes.push({ url: `${SITE_URL}/${city.id}/${slug}`, lastModified, changeFrequency: 'daily', priority: 0.7 });
    }
    for (const e of events) {
      routes.push({
        url: `${SITE_URL}${eventPath(city.id, e, map)}`,
        lastModified: e.updatedAt ? new Date(e.updatedAt) : lastModified,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }
  return routes;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): per-city sitemap with hubs and stable permalinks"
```

---

## Task 15: Environment wiring (Wrocław)

**Files:**
- Modify: `.env.local`
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Local env**

Append to `.env.local` (gitignored). Set the anon key from Supabase → project `gpdshmialackgmkdrdxq` → Project Settings → API → anon/publishable key:

```
NEXT_PUBLIC_SUPABASE_URL_WROCLAW=https://gpdshmialackgmkdrdxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW=<wroclaw anon key>
```

- [ ] **Step 2: Deploy workflow**

In `.github/workflows/deploy.yml`, under the `pnpm build` step `env:`, add:

```yaml
          NEXT_PUBLIC_SUPABASE_URL_WROCLAW: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL_WROCLAW }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW }}
```

- [ ] **Step 3: e2e workflow**

In `.github/workflows/e2e.yml`, under the "Run E2E tests" step `env:`, add the same two lines.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/e2e.yml
git commit -m "ci: pass Wrocław Supabase env to build and e2e"
```

- [ ] **Step 5 (manual, user):** Add repo secrets `NEXT_PUBLIC_SUPABASE_URL_WROCLAW` and `NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW` in GitHub → Settings → Secrets → Actions.

---

## Task 16: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Full type-check + unit tests**

Run: `corepack pnpm@10 type-check && corepack pnpm@10 test`
Expected: exit 0; all unit tests pass.

- [ ] **Step 2: Static build with both cities**

Run:
```bash
NEXT_PUBLIC_SUPABASE_URL_WROCLAW=https://gpdshmialackgmkdrdxq.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW=<wroclaw anon key> \
NEXT_PUBLIC_BASE_PATH='' corepack pnpm@10 build
```
Expected: build succeeds; `out/wroclaw/`, `out/szczecin/`, `out/wroclaw/muzyka/`, event permalink folders, `out/404.html`, and `out/sitemap.xml` all exist.

- [ ] **Step 3: Spot-check the export**

Run: `ls out && ls out/wroclaw && head -20 out/sitemap.xml`
Expected: city directories present; sitemap contains `/wroclaw/...` and `/szczecin/...` URLs.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore: multi-city static build verification fixes"
```

---

## Task 17: Rewrite e2e for the new routes

**Files:**
- Modify: `e2e/support/helpers.ts`
- Modify: `e2e/home.spec.ts`, `e2e/events-list.spec.ts`, `e2e/event-detail.spec.ts`, `e2e/filters.spec.ts`, `e2e/navigation-i18n.spec.ts`
- Create: `e2e/city-picker.spec.ts`

- [ ] **Step 1: Update `helpers.ts` for city-aware paths**

Add a launch-city constant and target the city list:

```ts
export const CITY = 'wroclaw';
// ...
export async function gotoEvents(page: Page): Promise<void> {
  await page.goto(`/${CITY}/wydarzenia`);
  await expect(firstCard(page)).toBeVisible({ timeout: 20000 });
}
```

Keep `search()`'s `waitForURL(/[?&]search=/)`.

- [ ] **Step 2: City picker spec**

Create `e2e/city-picker.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { CITY } from './support/helpers';

test.describe('City picker', () => {
  test('root shows the picker and links into a city', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /Wroc/ });
    await expect(link.first()).toBeVisible();
    await link.first().click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}(/|$)`));
  });

  test('deep-linking a city selects it directly', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await expect(page.locator('article').first()).toBeVisible({ timeout: 20000 });
  });
});
```

- [ ] **Step 3: Update existing specs' routes**

- `home.spec.ts`: `page.goto('/')` → `page.goto(\`/${CITY}\`)`; "browse all" / tile assertions expect `new RegExp(\`/${CITY}/wydarzenia\`)`.
- `events-list.spec.ts`: card-link regex `/\/events\/\d+/` → `new RegExp(\`/${CITY}/[a-z0-9-]+/[a-z0-9-]+-[0-9a-f]{8}\`)`; view-toggle URL assertions unchanged (query params).
- `event-detail.spec.ts`: navigate via `gotoEvents` + click first card; detail URL regex → the permalink pattern above; back returns to `new RegExp(\`/${CITY}/wydarzenia\`)`.
- `filters.spec.ts`: unchanged except routes come from `gotoEvents`.
- `navigation-i18n.spec.ts`: brand-logo click now lands on `/` (picker) — assert `getByText` of `CITY_PICKER_TITLE` ("Wybierz swoje miasto") instead of the hero prompt.

- [ ] **Step 4: Run e2e locally (chromium)**

Run:
```bash
NEXT_PUBLIC_SUPABASE_URL_WROCLAW=https://gpdshmialackgmkdrdxq.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW=<wroclaw anon key> \
corepack pnpm@10 exec playwright test --project=chromium
```
Expected: all specs pass.

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test(e2e): cover multi-city routes, picker and permalinks"
```

---

## Self-review notes (author)

- **Spec coverage:** routing (T4–T11), shared categories (T1,T3), per-city data (T3,T15), permalinks/`event_key` (T2,T3,T10), city picker (T6), URL-driven city (T5), graceful 404 (T10,T11), Wrocław (T1,T15), SEO/sitemap (T7,T9,T10,T14), i18n (T12), removals (T4), tests (T2,T3,T7,T17). Every spec section maps to a task.
- **Naming consistency:** `getCityEvents`, `fetchCategories()` (no arg), `eventPath`, `resolveCategorySlug`, `buildCategorySlugMap`, `shortId`, `nameSlug`, `CATEGORIES_CITY_ID`, `CATEGORY_FALLBACK_SLUG`, `NotFoundRedirect`, `CityRouteProvider`, `displayNameToSlug` are used consistently across tasks.
- **`event.eventKey`** is added in T3; T2's test fixtures cast `as Event` so the pure helper task compiles before the type change lands (both commit green when run in order T1→T17).
- **Security:** JSON-LD is serialized with `.replace(/</g, '\\u003c')` to prevent `</script>` breakout (T10).

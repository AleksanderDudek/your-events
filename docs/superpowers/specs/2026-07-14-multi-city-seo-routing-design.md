# Multi-city, SEO-first static routing — Design

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/multi-city-seo`

## Goal

Turn the single-city (Szczecin) event browser into a fully multi-city static app
with SEO-optimised, per-city URLs. First launch city is **Wrocław**; Szczecin
remains. The app is a Next.js `output: 'export'` static site on GitHub Pages, so
every page must be statically generatable.

## Confirmed context (from Supabase inspection, 2026-07-14)

- Two Supabase projects: **Szczecin** `ondqwtwoepttupvhwlkx` (446 events, 90
  categories) and **Wrocław** `gpdshmialackgmkdrdxq` (88 events, **0
  categories**).
- `events.category_main` / `category_sub` store the category **display_name**
  text (e.g. `"Sport i Fitness"`), not the slug. `categories` is the taxonomy
  source of truth (slug, parent_slug, display_name, display_plural, icon, color,
  sort_order, is_active).
- Wrocław event `category_main` values all match Szczecin category display_names.
  A few Szczecin events use `category_main = "Kultura"`, which has **no** category
  row.
- `events.id` is a per-project autoincrement that **churns** (Szczecin ids span
  15,448 for 446 rows → daily delete+reinsert). `event_key` is unique and stable
  (Szczecin: `sha256:<hex>`; Wrocław: source URL). **Permalinks must derive from
  `event_key`, never the numeric id.**
- `events.date` is stored as text (`YYYY-MM-DD`); string comparison filtering is
  fine.

## Decisions (locked)

1. **Permalink id** = stable short hash of `event_key` (not the churning numeric
   id). Plus a graceful "resource doesn't exist" page (timed redirect to search)
   for stale/expired/old-indexed URLs.
2. **Route map** = separate city landing + filterable list + per-category hubs.
3. **Root** (`/`) = fullscreen city picker; the **URL is the source of truth** for
   the selected city.
4. **Old `/events` + `/events/[id]` routes** = replaced outright (no redirects
   kept; the global 404 handles any stragglers).
5. **Categories/filters** = always sourced from **Szczecin**, for every city
   (conscious architectural inconsistency; Wrocław has no category rows).

## 1. Route map

```text
/                                     fullscreen city picker (static)
/{city}                               city landing (hero + tiles + map preview)
/{city}/wydarzenia                    filterable list (search/date/category/view/pagination)
/{city}/{category}                    category hub (static SEO page)
/{city}/{category}/{name}-{shortid}   event detail (static)
```

- Example: `/wroclaw/muzyka/vsjf-jazzy-tram-7a3f9c2b`.
- Canonical slugs are **Polish** and **not localized** per UI language — one
  canonical URL per page; language stays a client-side (localStorage) toggle.
  (hreflang / per-language URLs are explicitly out of scope for this change.)
- `dynamicParams = false` at every dynamic segment → any unbuilt path renders the
  static 404 (the graceful redirect page).
- `trailingSlash: true` in `next.config.js` so every nested route is emitted as
  `.../index.html` and resolves reliably on GitHub Pages (the conventional
  static-host setup for deep dynamic routes).

### App-router file layout

```text
app/
  page.tsx                       /            → CityPicker
  not-found.tsx                  404.html     → NotFoundRedirect (global)
  [city]/
    layout.tsx                   validates city (dynamicParams=false), provides CityProvider
    page.tsx                     /{city}      → city landing
    wydarzenia/page.tsx          /{city}/wydarzenia → list (client)
    [category]/
      page.tsx                   /{city}/{category} → category hub (static)
      [event]/
        page.tsx                 /{city}/{category}/{name}-{shortid} → detail (static)
        not-found.tsx            city-scoped graceful not-found
```

## 2. Slug + permalink helpers (`src/lib/slug.ts`, pure)

- `nameSlug(name)` — lowercase, ASCII-fold Polish diacritics (ą→a, ć→c, ę→e, ł→l,
  ń→n, ó→o, ś→s, ź/ż→z), non-alphanumeric → `-`, collapse repeats, trim, cap ~60
  chars. `"Joga Kręgosłupa"` → `joga-kregoslupa`.
- `shortId(eventKey)` — FNV-1a 32-bit over `event_key`, rendered as fixed 8 hex
  chars. Stable across rescrapes (same key ⇒ same id). Build asserts per-city
  uniqueness; on the (astronomically unlikely) collision, widen the hash.
- `resolveCategorySlug(categoryMain, displayNameToSlug)` — maps event
  `category_main` display_name → category slug; unmatched (`"Kultura"`) → `inne`.
- `eventPath(citySlug, event, displayNameToSlug)` — the one canonical URL builder:
  `/{city}/{categorySlug}/{nameSlug(name)}-{shortId(eventKey)}`. Used by cards,
  hubs, sitemap and detail resolution.
- Parsing detail params: `shortId = slug.slice(slug.lastIndexOf('-') + 1)` (the
  8-char id has no hyphens).

## 3. Data layer

- **Per-city events** stay in `eventsApi.fetchEvents(cityId, filters, catFilter)`
  (unchanged) for the client list.
- **`getCityEvents(cityId)`** — new build-time fetch-all-for-city, memoized at
  **module level** (build-process lifetime) so `generateStaticParams` and every
  detail/hub page reuse one fetch per city. Returns mapped `Event[]` plus the
  precomputed `shortId`/path index.
- **`fetchCategories()`** — pinned to `CATEGORIES_CITY_ID` (Szczecin) regardless
  of selected city. `queryKeys.categories` becomes global (drop the city scope).
- `mapRow` maps only the columns we use; extra columns (`room`, `all_urls`,
  `scraped_at`, `price_max`, …) are intentionally ignored — the tables are a data
  source, not a contract.
- Detail resolution: `[event]/page.tsx` reads `{city, category, slug}`, extracts
  `shortId`, finds the event in `getCityEvents(city)`. Miss → `notFound()`.
  Category mismatch is impossible for built paths (dynamicParams=false).

## 4. City config & context

- `cities.ts`: Wrocław becomes **available** via
  `NEXT_PUBLIC_SUPABASE_URL_WROCLAW` / `NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW`
  (existing `resolveSupabase` pattern). Ordering puts **Wrocław first**. Add
  `CATEGORIES_CITY_ID` constant (= Szczecin).
- `CityProvider`: **URL-driven**. `[city]/layout.tsx` reads the `city` segment,
  validates it (`isCityId` + availability), provides it. Geolocation/localStorage
  demoted to an optional "last visited" highlight on the picker — never a forced
  redirect.
- Header **city switcher** navigates to the target city's **landing**
  (`/{newCity}`), since event ids don't map across cities.
- `homeFilters.ts` builders return city-aware `/{city}/wydarzenia?...` URLs.

## 5. Pages

- **CityPicker (`/`)** — fullscreen; available-city cards (Wrocław, Szczecin) as
  plain links → crawlable, no JS required. Optional localStorage "last visited"
  highlight.
- **City landing (`/{city}`)** — `HomeView`, rewired: hero (city forms), 7
  quick-filter tiles → `/{city}/wydarzenia?...`, map preview → `?viewMode=map`,
  and links into category hubs.
- **List (`/{city}/wydarzenia`)** — `EventsListView` (client), city from route,
  filters in query params, cards link via `eventPath`, category filter uses the
  shared Szczecin categories.
- **Category hub (`/{city}/{category}`)** — static: H1 = category display_name,
  intro copy, static grid of that city's events for the category (grouped by
  `resolveCategorySlug`, so `"Kultura"` events appear under `inne`), capped ~48
  with a "see all" link to `/{city}/wydarzenia?categories={slug}`.
  `generateStaticParams` = category slugs **present** in each city (no empty hubs).
- **Event detail (`/{city}/{category}/{name}-{shortid}`)** — static server
  component fetches from `getCityEvents(city)` at build, renders `EventDetailView`
  (client, for back button + map). No client re-fetch (data is fresh from the 3h
  rebuild cadence).

## 6. Not-found / stale-URL UX

- `app/not-found.tsx` (emitted as `404.html`): friendly title + body + **visible
  countdown** and auto-redirect. Target: `/{city}/wydarzenia` if the current path
  starts with a valid city, else `/`. Immediate "Szukaj wydarzeń" button too.
- `[city]/[category]/[event]/not-found.tsx`: same UX, city-aware redirect to
  `/{city}/wydarzenia`. Reusable `NotFoundRedirect` client component.

## 7. SEO

- `generateMetadata` for city, category hub, and event (title/description +
  `alternates.canonical` = `SITE_URL + path`).
- JSON-LD: keep `Event` on detail; add `BreadcrumbList` (city → category → event);
  `ItemList` on hubs.
- `sitemap.ts` rebuilt to enumerate `/`, every city landing, every
  `/{city}/wydarzenia`, every non-empty category hub, and every event permalink
  (per city, via `eventPath`), `lastModified` from `updated_at`.
- `robots.ts` unchanged.

## 8. i18n

- New message keys (pl + en): city-picker (title/subtitle/CTA), not-found
  (title/body/countdown/CTA), category-hub intro. City grammatical forms already
  exist in `cities.ts` (Wrocław: locative "Wrocławiu", accusative "Wrocław").

## 9. Environment & CI

- `.env.local` (local): add `NEXT_PUBLIC_SUPABASE_URL_WROCLAW` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW`.
- `deploy.yml`: pass the two Wrocław vars to `pnpm build`.
- `e2e.yml`: pass them to the dev server used by Playwright.
- **Manual step (user):** add `NEXT_PUBLIC_SUPABASE_URL_WROCLAW` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY_WROCLAW` GitHub repo secrets (anon key is public,
  RLS-protected).

## 10. Removals / changes

- Remove `app/events/page.tsx`, `app/events/[id]/*`.
- Update `AppHeader` nav + city switcher, `AppFooter` links, `homeFilters.ts`,
  `next.config.js` (trailingSlash).

## 11. Testing

- **e2e** rewritten for the new routes: picker → city landing → list → category
  hub → detail → back; stale-URL → graceful redirect; language + city switch.
  Update `e2e/support/helpers.ts` (city-aware paths).
- **unit** for the pure helpers (`nameSlug`, `shortId`, `resolveCategorySlug`,
  `eventPath`) and `eventsApi` categories-pinning; update existing `eventsApi`
  tests for the `fetchCategories` signature change.

## 12. Implementation phases

1. **Foundation** — `cities.ts` (Wrocław available + order + `CATEGORIES_CITY_ID`);
   env wiring (`.env.local`, `deploy.yml`, `e2e.yml`); `slug.ts` helpers + unit
   tests; `eventsApi` (`getCityEvents` memo, `fetchCategories` pinned) + tests.
2. **Routing skeleton** — `[city]/layout.tsx` (URL-driven CityProvider), root
   `CityPicker`, remove `app/events/*`, `next.config` trailingSlash.
3. **Pages** — city landing, `/{city}/wydarzenia`, category hub, event detail.
4. **Not-found UX** — global + city-scoped `NotFoundRedirect`.
5. **SEO** — metadata per level, JSON-LD breadcrumbs, sitemap rebuild, canonical.
6. **i18n** — new keys (pl/en).
7. **Tests** — e2e rewrite + run; unit coverage.
8. **CI/deploy** — verify build with both cities green; confirm workflows.

## 13. Risks / notes

- **Permalink stability** depends on `event_key` stability. Recurring events on
  different dates get different keys (correct — distinct occurrences); the same
  occurrence keeps its key until it passes. Expired events 404 → graceful
  redirect (by design).
- **Build scale** ~570 pages; acceptable for static export. `getCityEvents`
  module memo keeps build fetches to one per city.
- **`shortId` collisions** negligible at hundreds of events/city; build-time
  uniqueness assertion guards.
- **Fork-PR CI** can't read Wrocław secrets → build/e2e degrade for forks only
  (personal repo; acceptable).

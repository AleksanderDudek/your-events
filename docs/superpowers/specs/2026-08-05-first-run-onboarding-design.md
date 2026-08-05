# First-run onboarding — design

Date: 2026-08-05
Status: implemented. v1 was a five-step feature tour; v2 (same day, at the
user's request) replaced it with a story the app performs.

## Why

A first-time visitor lands on a list of events with no idea that the site can do
anything else. Everything that makes it worth returning — filtering by date and
category, switching to the map, saving a filter set and coming back to it — is
discoverable only by poking at controls. On a phone the filter panel is a Fab
and the navigation is a drawer, so the features are literally off-screen.

The site is also a static export with no accounts. "New user" can only mean
"this browser has no record of having been here", so the whole feature hangs off
one localStorage key.

## Decisions

1. **A welcome sheet with an opt-in walkthrough, not a forced one.** On first
   visit a short sheet says what the site is and lists three things you can do.
   "Pokaż mi" starts the story; "Pomiń" dismisses it for good. A walkthrough
   nobody agreed to is the single most-skipped pattern in onboarding, and it
   stands between the visitor and the events they came for.
2. **The walkthrough is a story the app actually performs.** Not captions on
   controls — the app builds one concrete filter set in front of the visitor:
   dance or fitness classes, Monday/Tuesday/Thursday, 16:00–21:00 because that
   is when work ends. Then it saves that as a preset, opens it from Moje filtry,
   edits it to 18:00 when the story's job changes, and opens it again. What the
   visitor is left with is a real saved filter of their own, not the memory of a
   slideshow.
3. **Forward-only.** The steps have side effects — filters written, a preset
   saved and then edited — and stepping backwards through those would need an
   invented undo per step. Skip and Esc are always one click away instead.
4. **The story never competes with the cookie banner.** Onboarding stays closed
   while the consent banner is open. Two stacked overlays on a first visit is
   the failure this design most wants to avoid.
5. **An env flag switches the whole feature off.** `NEXT_PUBLIC_ONBOARDING_ENABLED`.
   Off means nothing renders, nothing is read from storage, and the footer
   replay link disappears.
6. **State is a `lib` + hook pair, not a provider.** Mirrors
   `lib/consent.ts` + `service/useConsent.ts` and `lib/presets.ts` +
   `service/usePresets.ts`.
7. **Storage records a version, not a boolean.** `go-to-city.onboarding` holds
   the version the visitor has seen. Bumping `ONBOARDING_VERSION` re-offers the
   sheet after a redesign, which a boolean cannot do — and v2 is exactly that
   case, so anyone who saw the v1 tour is offered the story.
8. **Steps anchor to real controls by `data-tour` attribute.** No prop drilling
   and no refs threaded through six components; the overlay queries the DOM.
9. **The story starts on the events list.** The sheet may appear on the city
   home too; "Pokaż mi" there navigates to the list first.

## Where it appears

| Route | Sheet | Story |
|---|---|---|
| `/` (city picker) | no | no |
| `/{city}/` | yes | no — "Pokaż mi" navigates to the list |
| `/{city}/wydarzenia/` | yes | starts here |
| `/moje-filtry/` | no | passes through it (steps 6 and 8) |
| `/{city}/{category}/`, event detail, `/prywatnosc/`, `/rozwijaj-z-nami/` | no | no |

The city picker is excluded because there is nothing there to explain. Leaf and
utility pages are excluded because an overlay on arrival from a search engine is
an interruption, not an introduction.

**The sheet also stays quiet for a visitor who arrived with filters in the URL.**
They followed a shared link and came for those results; the story would
overwrite them with dance classes on Thursdays.

## The story, step by step

| # | Step | What the app does | Anchor |
|---|---|---|---|
| 1 | `categories` | Ticks Taniec + Sport i Fitness | filter panel / Fab |
| 2 | `weekdays` | Narrows to Mon, Tue, Thu | filter panel / Fab |
| 3 | `hours` | 16:00–21:00 across the next 7 days | filter panel / Fab |
| 4 | `results` | — (reads the result count out) | results header |
| 5 | `save` | Saves it as the preset "Po pracy" | save-filters button |
| 6 | `presets` | Goes to Moje filtry | the new preset's tile |
| 7 | `open` | Opens the preset — back to the list | results header |
| 8 | `edit` | Moves the saved hours to 18:00, back to Moje filtry | the tile's edit button |
| 9 | `edited` | Opens it again, now 18:00–21:00 | results header |

Two details that are load-bearing rather than cosmetic:

- **Step 3 sets a date range as well as the hours.** The list only honours an
  hour window alongside a date one (see `presetToEventFilters`), so "16:00–21:00"
  on its own would silently do nothing.
- **Step 5 saves `dateWindow: 'next7'`, not the dates on screen.** Naively
  saving the on-screen filters would store an absolute `fixed` range, and a
  preset called "after work" pinned to this week rots into a link to the past.

## Architecture

| File | Role |
|---|---|
| `src/lib/onboarding.ts` | Pure. Storage key, `ONBOARDING_VERSION`, `parseSeenVersion`, `hasSeenCurrent`, `isOnboardingRoute(pathname, isCity)`, `isTourRoute(...)`, `tourPath(cityId)`. No DOM, no config imports — the city check arrives as a predicate so `/moje-filtry/` (also one segment long) is not mistaken for a city home. |
| `src/lib/tourSteps.ts` | Pure. The script: step ids, anchors, surfaces and **declarative actions**, plus the story's numbers (`storyDateRange`, `storyFilterPatch`, `storyPresetFilters`, `storyCategories`). No router, no storage — which is what makes the whole script unit-testable. |
| `src/components/service/useOnboarding.ts` | `useSyncExternalStore` over `localStorage` + the `storage` event. Owns storage and two transient flags: `{ isEnabled, isReady, hasSeen, isReplayRequested, isTourPending, markSeen, requestTour, clearTourRequest, replay }`. |
| `src/components/common/Onboarding/Onboarding.tsx` | Gatekeeper. Mounted once in `AppLayout`, so it renders on every page — deliberately cheap: route/consent/version checks and the sheet, nothing else. |
| `src/components/common/Onboarding/StoryRunner.tsx` | Performs the actions (categories query, presets store, filter router). Mounts **only while the story runs**, so the other 99% of page views do not subscribe to react-query for a dormant feature. |
| `src/components/common/Onboarding/TourOverlay.tsx` + `.module.scss` | Spotlight, tooltip, keyboard handling. Calls `onStepEnter` then hunts for the anchor. |
| `src/components/common/Onboarding/WelcomeSheet.tsx` + `.module.scss` | The sheet. |
| `src/config/env.ts`, `src/config/site.ts` | `NEXT_PUBLIC_ONBOARDING_ENABLED` → `IS_ONBOARDING_ENABLED`. |
| `src/i18n/messages.ts` | `ONBOARDING_*` keys, PL and EN, including the preset's name. |
| `AppFooter` | "Jak to działa?" replay link. |
| `FilterPanel`, `EventsListView`, `SavePresetButton`, `MyFiltersView`, `AppHeader` | `data-tour` attributes only — no logic. |

### State

Persisted: `go-to-city.onboarding`, the seen version as a decimal string.
Anything unparseable reads as "never seen", which re-offers the sheet — the safe
direction to fail in.

Transient (module-level in the hook, deliberately not persisted, as `useConsent`
handles `reopened`): `replayRequested` (footer link) and `tourPending` ("show
me" pressed on a page that cannot host the story).

The story's own progress — step index and the preset's id — is component state
in `TourOverlay` / `StoryRunner`. That survives the trip to Moje filtry and back
because `AppLayout` is not unmounted by client navigation, and dies on a reload,
which is the right lifetime for it.

### Hydration

The static export prerenders 1000+ pages. `useOnboarding` uses the same
`getServerSnapshot` constant + `isReady` gate as `useConsent`, so no overlay
markup ships in any prerendered page. `Onboarding` reads the arrival query
string from `window.location` in a lazy `useState` initialiser rather than via
`useSearchParams`, which in a root-layout component would push a Suspense
requirement onto every exported page.

### The spotlight

One fixed element per step, sized to the anchor's `getBoundingClientRect()` plus
8px, with `box-shadow: 0 0 0 9999px` painting the scrim around it. The tooltip
is an MUI `Popper` on the same element.

- The anchor is scrolled into view (instant — a smooth scroll would still be
  moving when the hole is measured).
- Scrolling stays unlocked; the hole follows its anchor on `scroll`/`resize`.
- Tooltip placement is a preference, not a promise: it may flip to any side and
  slide along the cross axis. Without that, the filters step put its tooltip off
  the right edge of a 393px viewport (found on mobile, fixed).
- The scrim swallows clicks, so the highlighted control cannot be operated out
  from under the story.
- `prefers-reduced-motion: reduce` drops the position transition.

### Accessibility

- The sheet is an MUI `Dialog` (focus trap, Esc, `aria-modal` for free).
- The tooltip is `role="dialog"` + `aria-modal`, labelled by its title; focus
  moves to it on every step and Tab is kept inside it.
- An `aria-live="polite"` region announces "Krok 2 z 9".
- Esc ends the story at any point and counts as seen.

## Error handling

| Case | Behaviour |
|---|---|
| localStorage throws (private mode, sandboxed iframe) | Treated as unset on read; writes swallowed. The visitor sees the sheet again next time. |
| Stored value is junk or from a future version | Reads as "never seen" → sheet offered. |
| An inert step's anchor is missing | Step dropped before the story starts. |
| An action-bearing step's anchor is missing | Kept — its action is usually what puts the anchor on screen (a navigation; the save button, which only exists once filters are active). |
| An anchor never arrives | Polled for ~2s, then that step is skipped. |
| The anchor disappears mid-step | The story advances to the next step. |
| The categories query has not resolved (or failed) | `storyCategories` falls back to the canonical slugs. Treating "not loaded" as "this city has none" once made step 1 tick nothing while the tooltip announced the list had narrowed. |
| Every step's anchor is missing | The story does not start; the visit is marked seen so it is not retried on every page load. |

## Testing

- **Unit** — version parsing, route predicates, the story's dates/patches/preset
  shape, and which steps survive a given page.
- **Component** — the sheet's two buttons; the overlay's step sequencing,
  one-action-per-step guarantee, late-arriving anchors, Esc, focus.
- **Integration (`Onboarding.spec.tsx`)** — the whole nine-step story against a
  mocked router and a real localStorage: filters written in three stages, the
  preset saved with `next7`, the walk to Moje filtry, the edit to 18:00 (still
  one preset, not two), and the final re-open.
- **e2e** — the same story in a real browser on desktop and mobile, asserting
  the URL after each stage and the preset in localStorage, plus an axe pass.

## Out of scope

- Analytics on where visitors drop out of the story.
- Letting the visitor drive the steps themselves (type in the search box, tick
  the boxes) rather than watching the app do it.
- Cleaning up the preset the story leaves behind — it is a real, useful filter,
  and the last step says it can be edited or deleted.

# First-run onboarding — design

Date: 2026-08-05
Status: approved (format chosen by the user; remaining calls made on their
instruction to "pick recommended")

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

1. **A welcome sheet with an opt-in tour, not a forced tour.** On first visit a
   short sheet says what the site is and lists three things you can do.
   "Pokaż mi" starts a spotlight tour; "Pomiń" dismisses it for good. A forced
   tour is the single most-skipped pattern in onboarding, and a tour that starts
   before the visitor has agreed to one reads as an obstacle between them and
   the events they came for.
2. **The tour never competes with the cookie banner.** Onboarding stays closed
   while the consent banner is open. Two stacked overlays on a first visit is
   the failure this design most wants to avoid.
3. **An env flag switches the whole feature off.** `NEXT_PUBLIC_ONBOARDING_ENABLED`.
   Off means nothing renders, nothing is read from storage, and the footer
   replay link disappears.
4. **State is a `lib` + hook pair, not a provider.** Mirrors
   `lib/consent.ts` + `service/useConsent.ts` and `lib/presets.ts` +
   `service/usePresets.ts`.
5. **Storage records a version, not a boolean.** `go-to-city.onboarding` holds
   the tour version the visitor has seen. Bumping `ONBOARDING_VERSION` re-offers
   the sheet after a redesign, which a boolean cannot do. Skip and complete are
   recorded identically — nothing in the product branches on which one it was,
   so storing the difference would be storing it for nobody.
6. **Steps anchor to real controls by `data-tour` attribute.** No prop drilling
   and no refs threaded through four components; the overlay queries the DOM.
   A step whose anchor is not on the page is dropped before the tour starts.
   That rule is what makes one step list work on both desktop and mobile.
7. **The tour lives on the events list.** That page holds every control worth
   teaching. The sheet may appear on the city home too; "Pokaż mi" there
   navigates to the list first and starts the tour on arrival.

## Where it appears

| Route | Sheet | Tour |
|---|---|---|
| `/` (city picker) | no | no |
| `/{city}/` | yes | no — "Pokaż mi" navigates to the list |
| `/{city}/wydarzenia/` | yes | yes |
| `/{city}/{category}/`, event detail, `/moje-filtry/`, `/prywatnosc/`, `/rozwijaj-z-nami/` | no | no |

The city picker is excluded because there is nothing there to explain: the page
is a list of two cities and picking one is self-evident. Leaf and utility pages
are excluded because an overlay on arrival from a search engine is an
interruption, not an introduction.

## Architecture

| File | Role |
|---|---|
| `src/lib/onboarding.ts` | Pure. `ONBOARDING_STORAGE_KEY`, `ONBOARDING_VERSION`, `parseSeenVersion(raw)`, `hasSeenCurrent(raw)`, `isOnboardingRoute(pathname, isCity)`, `isTourRoute(pathname, isCity)`, `tourPath(cityId)`. No DOM, no config imports — the city check arrives as a predicate so `/moje-filtry/` (also one segment long) is not mistaken for a city home. |
| `src/lib/tourSteps.ts` | Pure. `TOUR_STEPS: readonly TourStep[]` — `{ id, selector, placement }`. Copy lives in `messages.ts`, keyed by `id`. |
| `src/components/service/useOnboarding.ts` | `useSyncExternalStore` over `localStorage` + the `storage` event. Owns storage and the two transient flags only: `{ isEnabled, isReady, hasSeen, isReplayRequested, isTourPending, markSeen, requestTour, clearTourRequest, replay }`. Whether the sheet may open *here* is the orchestrator's call, because route and consent are properties of the page rather than of the store. |
| `src/components/common/Onboarding/Onboarding.tsx` | Orchestrator. Mounted once in `AppLayout`; decides sheet vs tour vs nothing. |
| `src/components/common/Onboarding/WelcomeSheet.tsx` + `.module.scss` | The sheet. |
| `src/components/common/Onboarding/TourOverlay.tsx` + `.module.scss` | Spotlight + step tooltip. |
| `src/config/env.ts`, `src/config/site.ts` | `NEXT_PUBLIC_ONBOARDING_ENABLED` → `IS_ONBOARDING_ENABLED`. |
| `src/i18n/messages.ts` | `ONBOARDING_*` keys, PL and EN. |
| `src/components/common/AppFooter/AppFooter.tsx` | "Jak to działa?" replay link, beside the existing Cookies link. |
| `FilterPanel`, `ViewToggle`, `SortSelect`, `AppHeader` | `data-tour` attributes only — no logic. |

### State

Persisted: one key, `go-to-city.onboarding`, whose value is the seen version as
a decimal string. Anything unparseable reads as "never seen", which re-offers
the sheet — the safe direction to fail in, since the cost is one dismissible
sheet and the alternative is silently hiding the feature forever.

Transient (module-level, deliberately not persisted, exactly as `useConsent`
handles `reopened`):

- `replayRequested` — the footer link was clicked. Reopens the sheet without
  clearing the stored version, so a reload does not reopen it again.
- `tourPending` — "Pokaż mi" was clicked on a page that cannot host the tour.
  Survives the client-side navigation to the list, dies on a full reload.

The sheet is open when `isReady && !hasSeen && !consentBannerOpen && !isTourPending && isOnboardingRoute(...)` — the first two from the hook, the rest composed in `Onboarding.tsx`.

### Hydration

The static export prerenders 1000+ pages. `useOnboarding` uses the same
`getServerSnapshot` constant + `isHydrated` gate as `useConsent`, so no overlay
markup ships in any prerendered page and no hydration mismatch is possible.

### The spotlight

One fixed-position element per step, sized to the anchor's
`getBoundingClientRect()` plus 8px, with `box-shadow: 0 0 0 9999px` painting the
scrim around it — no SVG mask, no cloning the anchor into a portal. The
tooltip is an MUI `Popper` anchored to the same element so collision-flipping
comes for free.

Behaviour:

- The anchor is scrolled into view (`block: 'center'`, instant — a smooth scroll would still be moving when the hole is measured) before the hole is drawn.
- Scrolling stays unlocked and the hole follows its anchor on `scroll` and `resize`. Locking the page would strand anyone who wants to see the highlighted control in context.
- Tooltip placement is a preference, not a promise: the Popper may flip to any side and slide along the cross axis. Without that, the filters step — a sidebar on desktop, a bottom-right Fab on a phone — put its tooltip off the right edge of a 393px viewport.
- The scrim swallows clicks — the tour is a read-only walkthrough, so a click
  on the highlighted control would move the page out from under the tour.
- `prefers-reduced-motion: reduce` drops the position transition.

### Accessibility

- The sheet is an MUI `Dialog` (focus trap, Esc, `aria-modal` for free).
- The tooltip is `role="dialog"` with `aria-modal="true"`, labelled by its title.
  Focus moves to it on every step change and returns to the page afterwards.
- A visually-hidden `aria-live="polite"` region announces "Krok 2 z 5".
- Esc ends the tour at any point and counts as seen.
- Every control is ≥44px and reachable by keyboard: Esc skip, Enter/Space next.

## Error handling

| Case | Behaviour |
|---|---|
| localStorage throws (private mode, sandboxed iframe) | Treated as unset on read; write failures are swallowed. The visitor sees the sheet again next time. |
| Stored value is junk or from a future version | Reads as "never seen" → sheet offered. |
| A step's anchor is missing (mobile, or a control that renders conditionally) | Step dropped before the tour starts. On a phone that means the search step goes: the search box lives inside the closed filter drawer, so the walkthrough opens on the filter Fab, whose copy covers the same ground. |
| The controls have not mounted yet (the tour was requested from the city home and the navigation has just landed) | Resolution is retried for ~1s before concluding there is nothing to point at. |
| Every step's anchor is missing | Tour does not start; the visit is marked seen so it is not retried on every page load. |
| The anchor disappears mid-tour (viewport resize collapsing the desktop panel into the Fab) | The tour advances to the next step whose anchor still exists; if none, it ends and marks seen. |

## Testing

- **Unit (`src/lib/*.spec.ts`)** — version parsing, junk and future values, route
  predicates. Pure, no DOM.
- **Hook (`useOnboarding.spec.tsx`)** — hydration gate, consent gate, flag off,
  replay leaving the stored version intact, cross-tab `storage` sync.
- **Component** — the sheet renders and both buttons resolve; the overlay drops
  steps with missing anchors, advances, ends on Esc, and traps focus.
- **e2e (`e2e/onboarding.spec.ts`)** — first visit with storage cleared: banner
  answered → sheet appears → "Pokaż mi" → spotlight lands on the search box →
  step through to the end → reload shows nothing. Plus an axe pass with the
  sheet open.

## Out of scope

- Per-feature inline tips (the third option considered; rejected as scattered
  state that is easy to miss).
- Analytics events for tour completion — Clarity already records the session,
  and adding events before anyone has asked a question of the data is guessing.
- A tour on the event detail page.

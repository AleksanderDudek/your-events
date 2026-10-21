# Filters on a phone — design

Date: 2026-10-21
Status: designed while the owner was away ("analyze, use best practices, pick
recommended, plan it out and finish on your own"); implemented under the
assumptions recorded here, to be reviewed on return.

## The request

> Na telefonie fajnie mieć szukajkę w innym miejscu → zwiększyć widoczność i
> rozmiar ikony filtrów. Dodać zamknięcie filtru poprzez ruch slide w dół.

Three changes, phone layout only (below the `md` breakpoint, 900 px):

1. The search box should not be hidden inside the filter drawer.
2. The filters trigger should be bigger and easier to see.
3. The filter drawer should close with a downward swipe.

## How it works today

Below `md`, `FilterPanel` renders no inline content: a 56 px round `Fab` with a
filter icon and a numeric badge sits fixed at the bottom right, and opens a
bottom `Drawer` holding the whole panel — search box first, then date,
weekdays, hours, nearby, categories — over a sticky "Wyczyść filtry /
Zastosuj" footer. The drawer has a drag handle drawn at its top, but nothing
reads a drag: it closes on the backdrop, on Escape or on a footer button.

So searching on a phone takes a tap on an unlabelled icon, then the box at the
top of an 85 %-high sheet, then a close.

## Decisions

### 1. Search on the page

**Recommended and chosen:** below `md`, the search box sits at the top of the
results, above the result count — visible, one tap away, and out of the
drawer. It is the same `SearchInput`, wired to the same URL state, so the
debounce, the clear button and the "clear filters remounts it" behaviour are
unchanged. Desktop keeps the search at the top of the sidebar.

It scrolls with the page rather than sticking under the header: a second
sticky bar would take a permanent 60 px of a phone screen, and search is what
people do first, at the top.

The static export prerenders `FilterPanel` before the breakpoint is known
(`useMediaQuery` reports `false` on the server), so an inline box rendered for
"not desktop" would flash on desktop until hydration and shift the list. It is
therefore rendered for "not desktop" *and* hidden at `md` and up by CSS: right
in the static HTML on both, and never two live search boxes once hydrated.

Rejected: a sticky toolbar holding search and the filter button (the request
is to make the filter *icon* more visible, not to replace it; and the space
cost above); the search in the app header (the header is global, the search
belongs to the list).

### 2. A trigger you cannot miss

**Recommended and chosen:** the round icon becomes an extended FAB — icon plus
the word **Filtry**, 56 px tall, bottom centre, with a white count pill when
anything in the drawer is set. A label removes the guesswork of a bare icon,
and centred it is equally reachable by either thumb (the convention for a
list's primary action, e.g. Airbnb's "Map" pill).

- The count is what is set *in the drawer*: the search is no longer there, so
  counting it would announce a filter the drawer does not show. The accessible
  name stays `Filtry (N)`, which contains the visible label (WCAG 2.5.3).
- It respects the safe area (`env(safe-area-inset-bottom)`), and the results
  get bottom padding on phones so the button never hides the last card or the
  pagination.
- It keeps the `data-tour="filters"` anchor the onboarding tour points at.

### 3. Swipe down to close

**Recommended and chosen:** MUI's `SwipeableDrawer` in place of `Drawer`. It
already does what a bottom sheet should:

- a downward drag anywhere on the sheet closes it — past 30 % of its height
  (`hysteresis={0.3}`, down from MUI's 52 %, which on an 85 %-high sheet is a
  long drag) or on a quick fling;
- while the content is scrolled down, the same drag scrolls it back up
  instead (MUI hands the gesture to a scrollable ancestor that is not at its
  start), so a long category list is never yanked shut mid-scroll;
- it only claims vertical drags, so the radius slider still slides;
- the drag handle finally means what it shows.

Swipe-to-*open* from the bottom edge is off (`disableSwipeToOpen`): the button
opens the sheet, and on iOS the bottom edge belongs to the home indicator.
Escape, the backdrop and both footer buttons still close it.

Rejected: a hand-rolled pointer-drag on the handle only — it would reimplement
velocity, thresholds and the scroll handoff that MUI ships and tests.

### "Wyczyść filtry" in the drawer keeps the search

On desktop the clear button sits in the same panel as the search and clears
it too. On a phone the search is outside the drawer, so the drawer's clear —
header and footer — resets what the drawer shows and leaves the search box
alone. The header button appears when something in the drawer is set. The
empty state's "clear filters" still clears everything, search included.

## Testing

- Unit (`FilterPanel.spec`, phone layout via a switchable `useMediaQuery`
  mock): the search box is on the page, not in the drawer; the trigger reads
  "Filtry" and counts drawer filters but not the search; the drawer's clear
  keeps the search. `useFilterNavigation.spec`: the keep-search reset.
- End to end (Mobile Chrome): searching without opening the drawer; the
  trigger is labelled and at least 48 px tall; a downward swipe on the sheet's
  handle closes it (real touch input through the Chrome DevTools Protocol).
- The e2e helpers stop using the search box as the "drawer is open" signal,
  and stop opening the drawer to search.

## Out of scope

- A sticky search bar, and hiding the button while scrolling.
- Swipe-to-open.
- Any change to the desktop sidebar.

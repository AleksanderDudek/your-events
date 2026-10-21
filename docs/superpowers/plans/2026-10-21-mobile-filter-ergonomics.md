# Filters on a Phone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, put the search box on the page, make the filters trigger a large labelled button, and let the filter sheet close with a downward swipe.

**Architecture:** All three live in `FilterPanel`'s phone branch (below MUI's `md`, 900 px). The search box renders above the results (and is hidden from `md` up by CSS, because the static export prerenders the phone branch). The round `Fab` becomes an extended, centred "Filtry" button whose count leaves the search out. `Drawer` becomes MUI's `SwipeableDrawer` with swipe-to-open off. The drawer's "clear" keeps the search through a new `clearFiltersExceptSearch` in `useFilterNavigation`. Spec: `docs/superpowers/specs/2026-10-21-mobile-filter-ergonomics-design.md`.

**Tech Stack:** Next.js 16 static export, React 19, MUI 7 (`SwipeableDrawer`, `Fab`), Vitest + Testing Library, Playwright (Chrome DevTools Protocol for touch).

**Conventions:** comments explain *why*; tests assert through roles and visible text; commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

| File | Change |
| --- | --- |
| `src/components/service/useFilterNavigation.ts` (+ spec) | `clearFiltersExceptSearch` |
| `src/components/common/FilterPanel/FilterPanel.tsx` (+ spec, `.module.scss`) | page search, extended trigger, swipeable drawer, drawer clear keeps search |
| `src/components/views/EventsListView/EventsListView.module.scss` | room under the results for the floating trigger |
| `e2e/support/helpers.ts`, `e2e/deep-linking.spec.ts` | stop treating the search box as part of the drawer |
| `e2e/mobile-filters.spec.ts` (new) | phone-only end-to-end checks, swipe included |

---

### Task 1: A reset that keeps the search

**Files:** `src/components/service/useFilterNavigation.ts`, `src/components/service/useFilterNavigation.spec.tsx`

- [ ] **Step 1: Failing test** — add after `it('clears every filter but keeps the view preferences', …)`:

```tsx
  // On a phone the search box sits on the page, outside the drawer this clear
  // belongs to.
  it('can clear every filter but the search term', async () => {
    const useFilterNavigation = await loadHook();
    settleUrl('search=jazz&categories=muzyka&freeOnly=true&viewMode=row');
    const { result } = renderHook(() => useFilterNavigation());

    act(() => result.current.clearFiltersExceptSearch());

    expect(window.location.search).toBe('?search=jazz&viewMode=row');
  });
```

Run: `pnpm vitest run src/components/service/useFilterNavigation.spec.tsx` — Expected: FAIL (`clearFiltersExceptSearch is not a function`).

- [ ] **Step 2: Implement** — below `clearFilters` in `useFilterNavigation.ts`:

```ts
  /**
   * clearFilters, minus the search term. On a phone the search box sits on the
   * page, outside the drawer whose "clear" this backs, so emptying it is not
   * that button's business.
   */
  const clearFiltersExceptSearch = useCallback(() => {
    const current = readCurrentFilters();
    applyFilters({
      ...getDefaultFilters(),
      viewMode: current.viewMode,
      pageSize: current.pageSize,
      search: current.search,
    });
  }, [applyFilters, readCurrentFilters]);
```

and return it: `return { filters, readCurrentFilters, updateFilters, updatePagination, clearFilters, clearFiltersExceptSearch };`

- [ ] **Step 3: Pass and commit**

Run: `pnpm vitest run src/components/service/useFilterNavigation.spec.tsx` — Expected: PASS.

```bash
git add src/components/service/useFilterNavigation.ts src/components/service/useFilterNavigation.spec.tsx
git commit -m "feat(filters): a reset that leaves the search term alone"
```

---

### Task 2: The phone layout

**Files:** `src/components/common/FilterPanel/FilterPanel.tsx`, `FilterPanel.spec.tsx`, `FilterPanel.module.scss`, `src/components/views/EventsListView/EventsListView.module.scss`

- [ ] **Step 1: Make the spec's layout and URL switchable** — in `FilterPanel.spec.tsx` replace the `next/navigation` and `useMediaQuery` mocks with:

```tsx
// Which layout and which query the panel sees; reset after every test.
const view = vi.hoisted(() => ({ isMdUp: true, query: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(view.query),
}));

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => view.isMdUp,
}));
```

add `within` to the Testing Library import and `afterEach` to the vitest import, and after the mocks:

```tsx
afterEach(() => {
  view.isMdUp = true;
  view.query = '';
  window.history.replaceState(null, '', '/');
});
```

- [ ] **Step 2: Failing tests** — append:

```tsx
describe('FilterPanel on a phone', () => {
  beforeEach(() => {
    view.isMdUp = false;
  });

  it('puts the search box on the page, not in the drawer', async () => {
    const user = userEvent.setup();
    render(<FilterPanel />);

    expect(screen.getByPlaceholderText('Szukaj wydarzenia lub miejsca...')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Filtry/ }));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Kategorie')).toBeInTheDocument();
    expect(within(drawer).queryByPlaceholderText('Szukaj wydarzenia lub miejsca...')).not.toBeInTheDocument();
  });

  // A bare icon in a corner was easy to miss; the count leaves the search out
  // because the drawer no longer shows it.
  it('labels the trigger and counts what the drawer holds, not the search', () => {
    view.query = 'search=jazz&freeOnly=true&weekdays=1';
    render(<FilterPanel />);

    const trigger = screen.getByRole('button', { name: 'Filtry (2)' });
    expect(trigger).toHaveTextContent(/^Filtry2$/);
  });

  it("clears what the drawer holds but leaves the page's search alone", async () => {
    view.query = 'search=jazz&freeOnly=true';
    window.history.replaceState(null, '', `/?${view.query}`);
    const user = userEvent.setup();
    render(<FilterPanel />);

    await user.click(screen.getByRole('button', { name: /^Filtry/ }));
    const drawer = await screen.findByRole('dialog');
    const clears = within(drawer).getAllByRole('button', { name: 'Wyczyść filtry' });
    await user.click(clears[clears.length - 1]);

    const params = new URLSearchParams(window.location.search);
    expect(params.get('search')).toBe('jazz');
    expect(params.has('freeOnly')).toBe(false);
  });
});
```

(`beforeEach` joins the vitest import.) Run: `pnpm vitest run src/components/common/FilterPanel` — Expected: the three new tests FAIL.

- [ ] **Step 3: Implement in `FilterPanel.tsx`**

Imports: replace `Drawer` with `import SwipeableDrawer from '@mui/material/SwipeableDrawer';`; take `clearFiltersExceptSearch` from `useFilterNavigation()`.

Below `const activeCount = countActiveFilters(filters);`:

```tsx
  // The phone drawer has no search box — it sits on the page — so what the
  // drawer counts (on its trigger, behind its clear button) leaves it out.
  const drawerCount = activeCount - (filters.search ? 1 : 0);
```

Below `handleClearAll`:

```tsx
  // The drawer's clear: everything the drawer shows, not the search box
  // outside it.
  const handleClearDrawer = useCallback(() => {
    clearFiltersExceptSearch();
    setExpanded(new Set());
  }, [clearFiltersExceptSearch]);

  const searchBox = (
    <SearchInput
      key={resetToken}
      value={filters.search}
      onChange={(search) => updateFilters({ search })}
    />
  );
```

Turn `const filterContent = (` into `const renderContent = (inSidebar: boolean) => (`; in it, the header's clear button becomes

```tsx
        {(inSidebar ? activeCount : drawerCount) > 0 && (
          <Button
            size="small"
            onClick={inSidebar ? handleClearAll : handleClearDrawer}
            sx={{ color: 'var(--color-accent-primary)' }}
          >
            {t.FILTER_CLEAR}
          </Button>
        )}
```

and the search section with its following divider becomes

```tsx
      {/* On a phone the search box sits on the page instead (see below). */}
      {inSidebar && (
        <>
          {/* data-tour marks the onboarding spotlight's anchor — see lib/tourSteps. */}
          <Box className={styles.section} data-tour="search">
            {searchBox}
          </Box>

          <Divider sx={{ borderColor: 'var(--color-border)' }} />
        </>
      )}
```

The sidebar renders `{renderContent(true)}`. The phone branch becomes:

```tsx
  return (
    <>
      {/* The search box, on the page rather than in the drawer. The static
          export is prerendered before the breakpoint is known, so this branch
          is what desktop gets until hydration too — the CSS hides it from md
          up, or desktop would show it and then shift the list. */}
      <Box className={styles.pageSearch} role="search" aria-label={t.SEARCH_LABEL}>
        {searchBox}
      </Box>

      {/* Same tour anchor as the desktop sidebar: only one of the two is ever
          mounted, so the step follows whichever layout the visitor is in.
          Labelled, large and centred: a bare icon in a corner was easy to
          miss, and the middle is equally in reach of either thumb. */}
      <Fab
        variant="extended"
        color="primary"
        data-tour="filters"
        onClick={() => setDrawerOpen(true)}
        aria-label={t.FILTER_TRIGGER(drawerCount)}
        sx={{
          position: 'fixed',
          insetInline: 0,
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          zIndex: 1000,
          width: 'max-content',
          height: 56,
          mx: 'auto',
          px: 3,
          gap: 1,
          fontSize: '1rem',
          fontWeight: 700,
          textTransform: 'none',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <FilterListIcon sx={{ fontSize: 26 }} />
        {t.FILTER_TITLE}
        {drawerCount > 0 && (
          <span className={styles.fabCount} aria-hidden="true">
            {drawerCount}
          </span>
        )}
      </Fab>

      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
        // The trigger opens it; the screen's bottom edge belongs to the system
        // (iOS's home indicator), not to a swipe-to-open.
        disableSwipeToOpen
        disableDiscovery
        // Close past 30 % of the sheet's height — MUI's 52 % is a long drag on
        // a sheet 85 % of the screen tall — or on a quick flick. Scrolled
        // content scrolls back first; MUI hands it the gesture.
        hysteresis={0.3}
        // MUI keeps a swipeable drawer mounted so a swipe can open it. With
        // that off, a closed drawer leaves the page as before: no hidden copy
        // of every filter label for screen readers and tests to trip on.
        ModalProps={{ keepMounted: false }}
        PaperProps={{
          sx: {
            maxHeight: '85vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
      >
        {/* The handle a thumb drags down to close the sheet. */}
        <Box className={styles.dragHandle} aria-hidden="true" />
        <Box>{renderContent(false)}</Box>
        <Box className={styles.drawerFooter}>
          <Button
            variant="outlined"
            onClick={() => {
              handleClearDrawer();
              setDrawerOpen(false);
            }}
            sx={{ flex: 1 }}
          >
            {t.FILTER_CLEAR}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setDrawerOpen(false)}
            sx={{ flex: 1 }}
          >
            {t.FILTER_APPLY}
          </Button>
        </Box>
      </SwipeableDrawer>
    </>
  );
```

- [ ] **Step 4: Styles** — in `FilterPanel.module.scss` replace `.fab { … }` with:

```scss
// The search box above the results, phones only. From md up the search sits
// in the sidebar, and this also hides the copy the prerendered HTML carries.
.pageSearch {
  @include md {
    display: none;
  }
}

// White pill on the accent button: how many filters the drawer holds.
.fabCount {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: var(--radius-pill);
  background-color: #ffffff;
  color: var(--color-accent-primary);
  font-size: 0.8125rem;
  font-weight: 800;
  line-height: 1;
}
```

In `EventsListView.module.scss`, `.results` becomes:

```scss
.results {
  flex: 1;
  min-width: 0;
  // Room under the last card and the pagination for the floating "Filtry"
  // button phones get (56 px tall, 16 px off the bottom). From md up the
  // filters are a sidebar instead.
  padding-bottom: 88px;

  @include md {
    padding-bottom: 0;
  }
}
```

- [ ] **Step 5: Pass and commit**

Run: `pnpm vitest run src/components/common/FilterPanel src/components/views/EventsListView && pnpm type-check && pnpm lint` — Expected: PASS / clean.

```bash
git add src/components/common/FilterPanel src/components/views/EventsListView/EventsListView.module.scss
git commit -m "feat(filters): on a phone, search on the page, a labelled trigger, and swipe to close"
```

---

### Task 3: End to end

**Files:** `e2e/support/helpers.ts`, `e2e/deep-linking.spec.ts`, `e2e/mobile-filters.spec.ts` (new)

- [ ] **Step 1: Helpers** — `openFilters` detects the drawer itself, not the search box:

```ts
export async function openFilters(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 900) return; // desktop: sidebar is always visible, nothing to open
  // Idempotent: an open drawer puts its backdrop over the trigger, and clicking
  // it there would hang. Selecting a category leaves the drawer open, so
  // callers can legitimately re-open.
  const drawer = page.locator('.MuiDrawer-paper');
  if (await drawer.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: FILTER_FAB }).click();
  await expect(drawer).toBeVisible();
}
```

and `search` no longer opens anything (the box is in the sidebar on desktop and on the page on a phone):

```ts
export async function search(page: Page, term: string): Promise<void> {
  await closeFilters(page);
  await page.getByPlaceholder(TEXT.searchPlaceholder).fill(term);
  await page.waitForURL(/[?&]search=/, { timeout: 10000 });
}
```

with their doc comments updated to match. In `e2e/deep-linking.spec.ts`, the `?search=` test drops its `await openFilters(page);` (and the import if unused).

- [ ] **Step 2: The spec** — `e2e/mobile-filters.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { CONSENT_STORAGE_KEY } from '../src/lib/consent';
import { ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION } from '../src/lib/onboarding';
import { CITY, TEXT, openFilters, waitForList } from './support/helpers';

// The phone layout: search on the page, a labelled trigger, a sheet that
// closes with a swipe. Desktop has none of it.
test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone layout only');
  // Answer both first-visit prompts up front: the cookie banner sits over the
  // trigger, and the onboarding sheet opens the moment it is answered.
  await page.addInitScript(
    ([consentKey, onboardingKey, version]) => {
      window.localStorage.setItem(consentKey, 'rejected');
      window.localStorage.setItem(onboardingKey, version);
    },
    [CONSENT_STORAGE_KEY, ONBOARDING_STORAGE_KEY, String(ONBOARDING_VERSION)] as const
  );
});

/**
 * A finger dragging down: real touch input through the DevTools protocol,
 * which is what MUI's swipe handling listens for (mouse events are not).
 */
async function swipeDown(page: Page, from: { x: number; y: number }, distance: number) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 10;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x, y: from.y + (distance * i) / steps }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.describe('Filters on a phone', () => {
  test('the search box is on the page, no drawer needed', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);

    const box = page.getByPlaceholder(TEXT.searchPlaceholder);
    await expect(box).toBeVisible();
    await box.fill('koncert');

    await page.waitForURL(/[?&]search=koncert/, { timeout: 10000 });
    await expect(page.locator('.MuiDrawer-paper')).toBeHidden();
  });

  test('the filters button is labelled and thumb-sized', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);

    const trigger = page.getByRole('button', { name: /^Filtry/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Filtry');
    expect((await trigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  });

  test('a downward swipe on the sheet closes it', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);
    await openFilters(page);

    const handle = page.locator('.MuiDrawer-paper [class*="dragHandle"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('The drawer has no drag handle');
    await swipeDown(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 400);

    await expect(page.locator('.MuiDrawer-root .MuiBackdrop-root')).toBeHidden();
  });
});
```

- [ ] **Step 3: Run**

Run: `pnpm exec playwright test e2e/mobile-filters.spec.ts e2e/filters.spec.ts e2e/deep-linking.spec.ts e2e/nearby.spec.ts --project=chromium --project="Mobile Chrome"`
Expected: PASS (the phone spec skips on desktop).

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): the phone filters — search on the page, the trigger, the swipe"
```

---

### Task 4: Verify and ship

- [ ] `pnpm lint && pnpm type-check && pnpm test`
- [ ] `pnpm build` (the required static export check)
- [ ] Screenshots on a phone viewport: the list with the search and the trigger; the open sheet.
- [ ] Merge to `main` and push; watch CI and the dev deploy; smoke-test the dev site on a phone viewport.

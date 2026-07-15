import { test, expect } from '@playwright/test';
import {
  TEXT,
  CITY,
  firstCard,
  gotoEvents,
  openFilters,
  applyFirstCategory,
  activeChip,
  waitForList,
} from './support/helpers';

// The REVERSE contract. The rest of the suite proves UI action → URL; these
// prove URL → UI: load a filtered permalink cold and assert the app hydrates
// its controls from the query string. This is where SSR/hydration bugs hide —
// a filter that "works when you click it" can still fail to restore from a
// shared/bookmarked link.
//
// Note: filterUtils drops default values from the URL (viewMode=grid, page=1),
// so every case here uses a NON-default value — otherwise there'd be nothing in
// the URL to hydrate from.
test.describe('Deep-linking filters (URL → UI)', () => {
  test('?viewMode=map loads straight into the map', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?viewMode=map`);
    // The Leaflet map mounts client-side (dynamic import, ssr:false). No click:
    // the URL alone must select the map view.
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });
  });

  test('?search=<term> pre-fills the search box', async ({ page }) => {
    const term = 'jazz';
    await page.goto(`/${CITY}/wydarzenia?search=${term}`);
    await waitForList(page);
    await openFilters(page);
    // The search input is a controlled field driven by filters.search (the URL).
    await expect(page.getByPlaceholder(TEXT.searchPlaceholder)).toHaveValue(term);
  });

  test('?freeOnly=true shows the free-only active-filter chip', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?freeOnly=true`);
    // freeOnly has no toggle in the panel — the chip is the only UI surface that
    // reflects it, and it renders purely from the parsed URL filter.
    await expect(activeChip(page, TEXT.freeOnlyChip)).toBeVisible({ timeout: 15000 });
  });

  test('a combined permalink hydrates every dimension at once', async ({ page }) => {
    // row view + freeOnly together: two independent filters restored from one URL.
    await page.goto(`/${CITY}/wydarzenia?viewMode=row&freeOnly=true`);
    await expect(firstCard(page)).toBeVisible({ timeout: 20000 });
    await expect(activeChip(page, TEXT.freeOnlyChip)).toBeVisible();
    // The view toggle reflects the row view (its button is pressed/selected).
    await expect(page.getByRole('button', { name: TEXT.viewList })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('a category selected in one visit restores as checked on a cold reload', async ({ page }) => {
    // Round-trip through the URL: discover a real category slug by selecting it,
    // then load that exact permalink fresh and assert the checkbox comes back
    // checked — proving the categories param drives the panel on first paint.
    await gotoEvents(page);
    const slug = await applyFirstCategory(page);
    expect(slug.length).toBeGreaterThan(0);

    await page.goto(`/${CITY}/wydarzenia?categories=${slug}`);
    await waitForList(page);
    await openFilters(page);
    // We don't need to know which label maps to the slug — that *some* checkbox
    // is checked proves the URL category hydrated the panel.
    await expect(page.getByRole('checkbox', { checked: true }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

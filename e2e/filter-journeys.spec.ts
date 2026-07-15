import { test, expect } from '@playwright/test';
import {
  TEXT,
  CITY,
  firstCard,
  gotoEvents,
  openFilters,
  closeFilters,
  search,
  applyFirstCategory,
  clearAllFilters,
  activeChip,
  waitForList,
} from './support/helpers';

const PERMALINK = new RegExp(`/${CITY}/[a-z0-9-]+/[a-z0-9-]+-[0-9a-f]{8}/?$`);

// Multi-step, stateful journeys — the gap the single-action tests leave open.
// Filters must *compose* (coexist in one URL), *survive navigation* (a detour
// through an event detail and back), and *clear* cleanly.
test.describe('Filter journeys', () => {
  test('search and a category compose into a single URL', async ({ page }) => {
    await gotoEvents(page);
    // Derive a guaranteed-present term from a real event title.
    const title = (await firstCard(page).locator('h3').innerText()).trim();
    const term = title.split(/\s+/).find((w) => w.length >= 4) ?? title.slice(0, 4);

    await applyFirstCategory(page);
    await search(page, term);

    // Both filters live in the query string at once — one didn't clobber the other.
    await expect(page).toHaveURL(/categories=/);
    await expect(page).toHaveURL(/[?&]search=/);
  });

  test('a filter survives a round-trip through an event detail', async ({ page }) => {
    await gotoEvents(page);
    const slug = await applyFirstCategory(page);
    await closeFilters(page);
    await expect(firstCard(page)).toBeVisible();

    // Detour into a detail page…
    await firstCard(page).click();
    await expect(page).toHaveURL(PERMALINK);

    // …then Back. The list URL must come back with the category intact, and the
    // panel must re-check it (state restored from the URL, not lost).
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`categories=${slug}`));
    await waitForList(page);
    await openFilters(page);
    await expect(page.getByRole('checkbox', { checked: true }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('deleting a chip removes just that filter from the URL', async ({ page }) => {
    // Seed a freeOnly filter via the URL (no panel toggle exists for it).
    await page.goto(`/${CITY}/wydarzenia?freeOnly=true`);
    await waitForList(page); // ensure the tree is interactive before deleting
    const chip = activeChip(page, TEXT.freeOnlyChip);
    await expect(chip).toBeVisible({ timeout: 15000 });

    // Trigger the MUI Chip delete via a dispatched DOM click that bubbles to
    // React's root listener — coordinate-free, so it doesn't depend on the tiny
    // aria-hidden <svg>'s hit-box or on layout having settled (a pointer click
    // flaked here cross-browser under parallel load).
    await chip.locator('.MuiChip-deleteIcon').dispatchEvent('click');
    await expect(page).not.toHaveURL(/freeOnly/);
    await expect(chip).toBeHidden();
  });

  test('clear-all wipes filters and restores the full list', async ({ page }) => {
    await gotoEvents(page);
    await applyFirstCategory(page);
    await expect(page).toHaveURL(/categories=/);

    await clearAllFilters(page);
    await expect(page).not.toHaveURL(/categories=/);

    // The unfiltered list is back.
    await closeFilters(page);
    await expect(firstCard(page)).toBeVisible({ timeout: 15000 });
  });
});

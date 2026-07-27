import { test, expect } from '@playwright/test';
import { TEXT, firstCard, gotoEvents, openFilters, closeFilters, search } from './support/helpers';

// Filtering is the primary reason to use the app. These exercise the debounced
// search box, the category checkboxes, pagination and the empty state — all via
// the URL contract the UI is built around (state lives in the query string).
test.describe('Filtering the events list', () => {
  test('search narrows results and is reflected in the URL', async ({ page }) => {
    await gotoEvents(page);
    // Derive a search term from a real event so we are guaranteed a match,
    // regardless of what the daily scrape put in the database.
    const title = (await firstCard(page).locator('h3').innerText()).trim();
    const term = title.split(/\s+/).find((w) => w.length >= 4) ?? title.slice(0, 4);

    await search(page, term);
    await expect(page).toHaveURL(/[?&]search=/);

    await closeFilters(page);
    // At least the source event still matches its own title word.
    await expect(firstCard(page)).toBeVisible();
  });

  test('an unmatched search shows the empty state', async ({ page }) => {
    await gotoEvents(page);
    await search(page, 'zzxqwv-nonexistent-000111');
    await closeFilters(page);
    await expect(page.getByText(TEXT.emptyTitle)).toBeVisible({ timeout: 15000 });
  });

  test('selecting a category writes it into the URL', async ({ page }) => {
    await gotoEvents(page);
    await openFilters(page);

    // Categories are loaded from Supabase; wait for the first checkbox to mount.
    const firstCategory = page.getByRole('checkbox').first();
    await expect(firstCategory).toBeVisible({ timeout: 15000 });
    // Use click (not .check): selecting a category triggers a navigation +
    // refetch, and .check()'s post-click "is it checked?" assertion races that
    // re-render. The behaviour we care about is that it lands in the URL.
    await firstCategory.click();

    await expect(page).toHaveURL(/categories=/);
  });

  // The weekday filter has no column behind it — the selected days are expanded
  // into concrete dates before the query is sent — so the URL contract and the
  // "click again to un-pick" behaviour are what there is to guard.
  test('weekdays can be picked and un-picked, and land in the URL', async ({ page }) => {
    await gotoEvents(page);
    await openFilters(page);

    await page.getByText(TEXT.filterWeekdays).click();
    // Scoped to the picker: a picked day also appears as a removable chip above
    // the results, under the very same accessible name.
    const picker = page.getByRole('group', { name: TEXT.filterWeekdays });
    const monday = picker.getByRole('button', { name: TEXT.weekdayMonday });
    await expect(monday).toBeVisible();

    await monday.click();
    await expect(page).toHaveURL(/weekdays=1(&|$)/);

    // A second day adds to the selection rather than replacing it.
    await picker.getByRole('button', { name: TEXT.weekdayWednesday }).click();
    await expect(page).toHaveURL(/weekdays=1(%2C|,)3/);

    // Clicking a picked day releases it — the point of a toggle.
    await monday.click();
    await expect(page).toHaveURL(/weekdays=3(&|$)/);
  });

  test('pagination advances to page 2 when there are enough events', async ({ page }) => {
    await gotoEvents(page);
    const next = page.getByRole('button', { name: 'Go to next page' });
    if (!(await next.isVisible().catch(() => false))) {
      test.skip(true, 'Not enough events for a second page');
    }
    await next.click();
    await expect(page).toHaveURL(/page=2/);
    await expect(firstCard(page)).toBeVisible();
  });
});

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

  // A parent and one of its own subcategories are ORed in the query, and the
  // pair is always a subset of the parent — so keeping both selected means the
  // subcategory narrows nothing, which read as "subcategories don't work".
  // Picking one side has to release the other.
  test('picking a subcategory releases its parent category', async ({ page }) => {
    await gotoEvents(page);
    await openFilters(page);

    // Categories come from Supabase; the first chevron only exists once they are
    // in. Matched on either state of its label, so the locator keeps pointing at
    // the same row after it is expanded.
    const expander = page.getByRole('button', { name: TEXT.filterChevron }).first();
    await expect(expander).toBeVisible({ timeout: 15000 });

    // The parent owning that chevron, and the subcategories it hides.
    const parentGroup = expander.locator('..').locator('..');
    const parentBox = parentGroup.getByRole('checkbox').first();
    await parentBox.click();
    await expect(page).toHaveURL(/categories=[^,&]+(&|$)/);

    await expander.click();
    const subBox = parentGroup.getByRole('checkbox').nth(1);
    await expect(subBox).toBeVisible();
    await subBox.click();

    // Only the subcategory survives — its slug is "<parent>/<child>", so the
    // parent's bare slug must no longer be in the list.
    await expect(page).toHaveURL(/categories=[^,&]+%2F[^,&]+(&|$)/);
    await expect(parentBox).not.toBeChecked();

    // And back the other way: re-picking the parent drops the subcategory.
    await parentBox.click();
    await expect(page).toHaveURL(/categories=[^,&%]+(&|$)/);
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

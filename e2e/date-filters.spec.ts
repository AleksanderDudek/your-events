import { test, expect } from '@playwright/test';
import { TEXT, CITY } from './support/helpers';

// The home quick-filter tiles encode date/hour windows (buildNowUrl,
// buildWeekendUrl). Those hrefs are computed client-side from the user's clock,
// so the tile ships a plain list-URL fallback and UPGRADES to the date-filtered
// href after hydration. We assert on the href attribute (Playwright retries it
// until the upgrade lands) — that's race-free, unlike clicking immediately.
//
// Time-safe by design: we assert the shape of the params (dateMode=single,
// hourFrom present), never a specific date — the suite must survive any clock.
test.describe('Home quick-filter date windows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${CITY}`);
  });

  test('"teraz" tile carries a single-day + hour window', async ({ page }) => {
    const tile = page.getByRole('link').filter({ hasText: TEXT.homeNowTitle }).first();
    await expect(tile).toBeVisible();
    // buildNowUrl → dateMode=single & dateSingle=YYYY-MM-DD & hourFrom=HH:MM.
    await expect(tile).toHaveAttribute('href', /dateMode=single/, { timeout: 15000 });
    await expect(tile).toHaveAttribute('href', /dateSingle=\d{4}-\d{2}-\d{2}/);
    await expect(tile).toHaveAttribute('href', /hourFrom=\d{2}(%3A|:)\d{2}/);
  });

  test('"weekend" tile carries a Fri–Sun date range', async ({ page }) => {
    const tile = page.getByRole('link').filter({ hasText: TEXT.homeWeekendTitle }).first();
    await expect(tile).toBeVisible();
    // buildWeekendUrl → dateMode=range & dateFrom & dateTo & 12:00–23:00.
    await expect(tile).toHaveAttribute('href', /dateMode=range/, { timeout: 15000 });
    await expect(tile).toHaveAttribute('href', /dateFrom=\d{4}-\d{2}-\d{2}/);
    await expect(tile).toHaveAttribute('href', /dateTo=\d{4}-\d{2}-\d{2}/);
  });

  test('clicking "teraz" lands on the events list with the date filter applied', async ({ page }) => {
    const tile = page.getByRole('link').filter({ hasText: TEXT.homeNowTitle }).first();
    // Wait for the hydration upgrade before navigating, so we follow the
    // date-filtered href rather than the plain-list fallback.
    await expect(tile).toHaveAttribute('href', /dateSingle=/, { timeout: 15000 });
    await tile.click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia`));
    await expect(page).toHaveURL(/dateSingle=/);
  });
});

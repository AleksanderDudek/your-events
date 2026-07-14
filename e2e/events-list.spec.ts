import { test, expect } from '@playwright/test';
import { TEXT, firstCard, gotoEvents } from './support/helpers';

// Core browsing surface: the events list renders cards from Supabase and lets
// the user switch between grid / list / map presentations.
test.describe('Events list', () => {
  test('renders event cards from Supabase', async ({ page }) => {
    await gotoEvents(page);
    await expect(firstCard(page)).toBeVisible();
    expect(await page.locator('article').count()).toBeGreaterThan(0);
  });

  test('shows a live result count', async ({ page }) => {
    await gotoEvents(page);
    await expect(page.getByText(TEXT.resultsCount)).toBeVisible();
  });

  test('each card links to a numeric event detail route', async ({ page }) => {
    await gotoEvents(page);
    // Event ids are Supabase integers, e.g. /events/1234 — never the legacy
    // "evt-xxx" mock ids.
    const href = await firstCard(page).locator('xpath=ancestor::a').first().getAttribute('href');
    expect(href).toMatch(/\/events\/\d+/);
  });

  test('view toggle switches grid → list → map and reflects it in the URL', async ({ page }) => {
    await gotoEvents(page);

    await page.getByRole('button', { name: TEXT.viewList }).click();
    await expect(page).toHaveURL(/viewMode=row/);

    await page.getByRole('button', { name: TEXT.viewMap }).click();
    await expect(page).toHaveURL(/viewMode=map/);
    // The Leaflet map mounts client-side only (dynamic import, ssr:false).
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

    // Grid is the default view, so the app drops viewMode from the URL entirely
    // rather than writing viewMode=grid. Assert we're back to the default grid.
    await page.getByRole('button', { name: TEXT.viewGrid }).click();
    await expect(page).not.toHaveURL(/viewMode=(map|row)/);
    await expect(firstCard(page)).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

// A path the build did not write. GitHub Pages answers it with 404.html — the
// SPA fallback — whose router renders NotFoundRedirect: a 404 message, then a
// countdown to the closest real page. `serve` answers the same way here.
//
// The event case is the one that matters day to day: the site is rebuilt every
// few hours, so a link to an event added since the last build is routine.

test.describe('Static export: not found', () => {
  test('an unknown event of a live city says 404, then lands on that city’s list', async ({ page }) => {
    const response = await page.goto('/wroclaw/muzyka/nie-ma-takiego-00000000/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();

    await expect(page).toHaveURL(/\/wroclaw\/wydarzenia\/$/, { timeout: 15_000 });
    await expect(page.locator('a:has(article)').first()).toBeVisible({ timeout: 20_000 });
  });

  test('an unknown path outside any city goes to the city picker', async ({ page }) => {
    const response = await page.goto('/to-nie-istnieje/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByText('Wybierz swoje miasto')).toBeVisible();
  });
});

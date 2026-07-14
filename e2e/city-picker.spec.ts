import { test, expect } from '@playwright/test';
import { CITY } from './support/helpers';

// The root route ("/") is now a fullscreen city picker rather than a city's
// landing page. It links into each available city's own subtree.
test.describe('City picker', () => {
  test('root shows the picker and links into a city', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /Wroc/ });
    await expect(link.first()).toBeVisible();
    await link.first().click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}(/|$)`));
  });

  test('deep-linking a city selects it directly', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await expect(page.locator('article').first()).toBeVisible({ timeout: 20000 });
  });
});

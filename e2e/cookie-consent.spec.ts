import { test, expect } from '@playwright/test';

const REGION = { name: 'Zgoda na cookies' };

test.describe('Cookie consent', () => {
  test('asks once, then remembers the answer across a reload', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('region', REGION);
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: 'Akceptuję' }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole('region', REGION)).toBeHidden();
  });

  test('a rejection also sticks', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Odrzucam' }).click();
    await page.reload();
    await expect(page.getByRole('region', REGION)).toBeHidden();
  });

  test('the footer link brings the choice back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Akceptuję' }).click();
    await expect(page.getByRole('region', REGION)).toBeHidden();

    await page.getByRole('button', { name: 'Cookies' }).click();
    await expect(page.getByRole('region', REGION)).toBeVisible();
  });
});

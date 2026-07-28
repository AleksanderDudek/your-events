import { test, expect } from '@playwright/test';
import { TEXT } from './support/helpers';

const REGION = { name: TEXT.cookieRegion };

test.describe('Cookie consent', () => {
  test('asks once, then remembers the answer across a reload', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('region', REGION);
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: TEXT.cookieAccept }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole('region', REGION)).toBeHidden();
  });

  test('a rejection also sticks', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('region', REGION);

    await page.getByRole('button', { name: TEXT.cookieReject }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole('region', REGION)).toBeHidden();
  });

  test('the footer link brings the choice back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: TEXT.cookieAccept }).click();
    await expect(page.getByRole('region', REGION)).toBeHidden();

    await page.getByRole('button', { name: TEXT.cookieFooterLink }).click();
    await expect(page.getByRole('region', REGION)).toBeVisible();
  });
});

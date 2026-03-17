import { test, expect } from '@playwright/test';

test.describe('Events List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/events');
  });

  test('displays events on the page', async ({ page }) => {
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('shows result count', async ({ page }) => {
    await expect(page.getByText(/Znaleziono \d+ wydarzeń/)).toBeVisible();
  });

  test('search filters events with debounce', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Szukaj wydarzeń...');
    await searchInput.fill('Hip Hop');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/search=Hip\+Hop/);
  });

  test('category filter updates URL', async ({ page }) => {
    const categoriesSection = page.getByText('Kategorie');
    await categoriesSection.click();
    const danceCheckbox = page.getByRole('checkbox').first();
    await danceCheckbox.check();
    await expect(page).toHaveURL(/categories=/);
  });

  test('pagination works', async ({ page }) => {
    const nextButton = page.getByLabel('Go to next page');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test('view toggle switches between grid and list', async ({ page }) => {
    const listToggle = page.getByLabel('Widok listy');
    await listToggle.click();
    await expect(page).toHaveURL(/viewMode=row/);
  });

  test('empty state shows when no results match', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Szukaj wydarzeń...');
    await searchInput.fill('xyznonexistent12345');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Nie znaleziono wydarzeń')).toBeVisible();
  });
});

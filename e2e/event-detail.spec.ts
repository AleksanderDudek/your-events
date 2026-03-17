import { test, expect } from '@playwright/test';

test.describe('Event Detail Page', () => {
  test('navigates to detail from card click', async ({ page }) => {
    await page.goto('/events');
    await page.locator('article').first().click();
    await expect(page).toHaveURL(/\/events\/evt-/);
  });

  test('displays event details', async ({ page }) => {
    await page.goto('/events/evt-001');
    await expect(page.getByRole('heading', { name: /Hip Hop Choreo/ })).toBeVisible();
    await expect(page.getByText('Kimama Dance Studio')).toBeVisible();
  });

  test('back button navigates back', async ({ page }) => {
    await page.goto('/events');
    await page.locator('article').first().click();
    await page.getByText('Wróć').click();
    await expect(page).toHaveURL(/\/events/);
  });

  test('external link has correct attributes', async ({ page }) => {
    await page.goto('/events/evt-001');
    const externalLink = page.getByText('Przejdź do strony');
    await expect(externalLink).toBeVisible();
    const link = externalLink.locator('xpath=ancestor::a');
    if (await link.count() > 0) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });

  test('shows 404 for non-existent event', async ({ page }) => {
    await page.goto('/events/evt-nonexistent');
    await expect(page.getByText(/nie znaleziono/i)).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { TEXT, gotoEvents } from './support/helpers';

// Cross-cutting shell features: language switching (pl↔en), the city picker
// (multi-city data source) and header navigation.
test.describe('Navigation, i18n and city switching', () => {
  test('language switch re-renders the UI in English', async ({ page }) => {
    await gotoEvents(page);
    // Sanity: Polish default copy is present first.
    await expect(page.getByText(TEXT.resultsCount)).toBeVisible();

    await page.getByRole('button', { name: TEXT.langEn }).click();

    // Same result-count string, now in English → the whole tree re-localised.
    await expect(page.getByText(TEXT.resultsCountEn)).toBeVisible();
  });

  test('city picker opens and lists the current city', async ({ page }) => {
    // Wait for the client app to hydrate (cards rendered) before clicking the
    // header button — a bare goto can click it before its onClick is attached,
    // making the menu never open (the cause of a cold-start CI flake here).
    await gotoEvents(page);
    await page.getByRole('button', { name: TEXT.cityLabel }).click();
    // Szczecin is the default, always-available city.
    await expect(page.getByRole('option', { name: 'Szczecin' })).toBeVisible();
  });

  test('brand logo returns to the home page', async ({ page }) => {
    await page.goto('/events');
    await page.getByRole('banner').getByText('Idź na miasto').click();
    // .first(): hero content can transiently duplicate during dev hydration.
    await expect(page.getByText(TEXT.heroPrompt).first()).toBeVisible();
  });
});

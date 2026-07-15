import { test, expect } from '@playwright/test';
import { TEXT, CITY_OTHER, gotoEvents } from './support/helpers';

// Cross-cutting shell features: language switching (pl↔en), the header city
// switcher (multi-city data source) and header navigation.
test.describe('Navigation, i18n and city switching', () => {
  test('language switch re-renders the UI in English', async ({ page }) => {
    await gotoEvents(page);
    // Sanity: Polish default copy is present first.
    await expect(page.getByText(TEXT.resultsCount)).toBeVisible();

    await page.getByRole('button', { name: TEXT.langEn }).click();

    // Same result-count string, now in English → the whole tree re-localised.
    await expect(page.getByText(TEXT.resultsCountEn)).toBeVisible();
  });

  test('header city switcher opens and lists the current city', async ({ page }) => {
    // Wait for the client app to hydrate (cards rendered) before clicking the
    // header button — a bare goto can click it before its onClick is attached,
    // making the menu never open (the cause of a cold-start CI flake here).
    await gotoEvents(page);
    await page.getByRole('button', { name: TEXT.cityLabel }).click();
    // Wrocław is the launch city being tested here (always available).
    await expect(page.getByRole('option', { name: /Wroc/ })).toBeVisible();
  });

  test('switching city navigates to that city and renders its landing', async ({ page }) => {
    // End-to-end city change (not just "the menu opens"): pick the other
    // available city (Szczecin) and land on its subtree.
    await gotoEvents(page);
    await page.getByRole('button', { name: TEXT.cityLabel }).click();
    await page.getByRole('option', { name: TEXT.cityOther }).click();

    await expect(page).toHaveURL(new RegExp(`/${CITY_OTHER}(/|$|\\?)`));
    // The destination city's landing page renders its hero headline.
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/Idź na/);
  });

  test('language preference persists across a reload', async ({ page }) => {
    // The current re-render test proves the immediate switch. This proves the
    // localStorage round-trip in LocaleProvider: first paint after reload is
    // Polish (so SSR/static HTML matches), then the stored 'en' is re-applied
    // post-hydration. Playwright retries until the English copy reappears.
    await gotoEvents(page);
    await page.getByRole('button', { name: TEXT.langEn }).click();
    await expect(page.getByText(TEXT.resultsCountEn)).toBeVisible();

    await page.reload();
    await expect(page.getByText(TEXT.resultsCountEn)).toBeVisible({ timeout: 15000 });
  });

  test('brand logo returns to the city picker', async ({ page }) => {
    // The header brand now links to "/" — the fullscreen city picker — not a
    // city's own landing page.
    await gotoEvents(page);
    await page.getByRole('banner').getByText('Idź na miasto').click();
    await expect(page.getByText(TEXT.cityPickerTitle)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

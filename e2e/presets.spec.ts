import { test, expect } from '@playwright/test';
import { TEXT, CITY } from './support/helpers';

// Saved filters live in localStorage and are written by one component, read by
// another, on a different route. Only a real browser run proves that round
// trip — and that the tile's href still expands to the filters that were saved.
test.describe('My filters (saved presets)', () => {
  test.beforeEach(async ({ page }) => {
    // Each test starts from an empty store, so one run cannot seed the next.
    // Cleared once, on this document — an addInitScript would fire on every
    // navigation and wipe the preset the test had just saved.
    await page.goto('/moje-filtry');
    await page.evaluate(() => window.localStorage.clear());
  });

  test('saving from the list produces a tile that reopens those filters', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?categories=taniec&freeOnly=true`);
    await expect(page.getByText(TEXT.resultsCount)).toBeVisible({ timeout: 25000 });

    await page.getByRole('button', { name: TEXT.presetsSaveCurrent }).click();
    await page.getByLabel(TEXT.presetsName).fill('Taniec za darmo');
    await page.getByRole('button', { name: TEXT.presetsSave, exact: true }).click();

    await page.goto('/moje-filtry');
    const tile = page.getByRole('link', { name: /Taniec za darmo/ });
    await expect(tile).toBeVisible();

    // The href carries the filters, not just the route.
    const href = (await tile.getAttribute('href')) ?? '';
    expect(href).toContain('categories=taniec');
    expect(href).toContain('freeOnly=true');

    await tile.click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia/?\\?.*categories=taniec`));
    await expect(page.getByText(TEXT.resultsCount)).toBeVisible({ timeout: 25000 });
  });

  test('presets survive a reload — they are the point of saving them', async ({ page }) => {
    await page.goto('/moje-filtry');
    await page.getByRole('button', { name: TEXT.presetsNew }).click();
    await page.getByLabel(TEXT.presetsName).fill('Wieczory taneczne');
    await page.getByRole('button', { name: TEXT.presetsSave, exact: true }).click();
    await expect(page.getByText('Wieczory taneczne')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Wieczory taneczne')).toBeVisible();
  });

  test('a relative date window resolves to real dates when the tile is opened', async ({ page }) => {
    // A preset saved as "this weekend" must not freeze the weekend it was made
    // in — the href is rebuilt from today's date every time the page renders.
    await page.goto('/moje-filtry');
    await page.getByRole('button', { name: TEXT.presetsNew }).click();
    await page.getByLabel(TEXT.presetsName).fill('Weekend');
    await page.getByLabel(TEXT.presetsWhen).click();
    await page.getByRole('option', { name: TEXT.presetsWeekend }).click();
    await page.getByRole('button', { name: TEXT.presetsSave, exact: true }).click();

    const href = (await page.getByRole('link', { name: /Weekend/ }).getAttribute('href')) ?? '';
    expect(href).toMatch(/dateFrom=\d{4}-\d{2}-\d{2}/);
    expect(href).toMatch(/dateTo=\d{4}-\d{2}-\d{2}/);
  });

  test('an empty store explains how to fill it', async ({ page }) => {
    await page.goto('/moje-filtry');
    await expect(page.getByText(TEXT.presetsEmpty)).toBeVisible();
  });
});

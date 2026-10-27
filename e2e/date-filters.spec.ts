import { test, expect } from '@playwright/test';
import {
  TEXT,
  CITY,
  closeFilters,
  openFilters,
  skipFirstVisitPrompts,
  waitForList,
} from './support/helpers';

// The home quick-filter tiles encode date/hour windows (buildNowUrl,
// buildWeekendUrl). Those hrefs are computed client-side from the user's clock,
// so the tile ships a plain list-URL fallback and UPGRADES to the date-filtered
// href after hydration. We assert on the href attribute (Playwright retries it
// until the upgrade lands) — that's race-free, unlike clicking immediately.
//
// Time-safe by design: we assert the shape of the params (dateMode=single,
// hourFrom present), never a specific date — the suite must survive any clock.
test.describe('Home quick-filter date windows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${CITY}`);
  });

  test('"teraz" tile carries a single-day + hour window', async ({ page }) => {
    const tile = page.getByRole('link').filter({ hasText: TEXT.homeNowTitle }).first();
    await expect(tile).toBeVisible();
    // buildNowUrl → dateMode=single & dateSingle=YYYY-MM-DD & hourFrom=HH:MM.
    await expect(tile).toHaveAttribute('href', /dateMode=single/, { timeout: 15000 });
    await expect(tile).toHaveAttribute('href', /dateSingle=\d{4}-\d{2}-\d{2}/);
    await expect(tile).toHaveAttribute('href', /hourFrom=\d{2}(%3A|:)\d{2}/);
  });

  test('"weekend" tile carries a Fri–Sun date range', async ({ page }) => {
    const tile = page.getByRole('link').filter({ hasText: TEXT.homeWeekendTitle }).first();
    await expect(tile).toBeVisible();
    // buildWeekendUrl → dateMode=range & dateFrom & dateTo & 12:00–23:00.
    await expect(tile).toHaveAttribute('href', /dateMode=range/, { timeout: 15000 });
    await expect(tile).toHaveAttribute('href', /dateFrom=\d{4}-\d{2}-\d{2}/);
    await expect(tile).toHaveAttribute('href', /dateTo=\d{4}-\d{2}-\d{2}/);
  });

  test('clicking "teraz" lands on the events list with the date filter applied', async ({ page }) => {
    const tile = page.getByRole('link').filter({ hasText: TEXT.homeNowTitle }).first();
    // Wait for the hydration upgrade before navigating, so we follow the
    // date-filtered href rather than the plain-list fallback.
    await expect(tile).toHaveAttribute('href', /dateSingle=/, { timeout: 15000 });
    await tile.click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia`));
    await expect(page).toHaveURL(/dateSingle=/);
  });
});

// With no date picked the list asks for today → +3 months (the tables keep
// past events, which used to head the list), and the quick picks are what let
// a saved filter mean "today" every time it is opened.
test.describe('Default date window and quick picks', () => {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  test.beforeEach(async ({ page }) => {
    await skipFirstVisitPrompts(page);
  });

  test('with no date picked, the list asks only for today onwards', async ({ page }) => {
    // The test and the browser share a clock and a timezone, so "today" is the
    // same day on both sides (bar a run that straddles midnight).
    const today = ymd(new Date());
    const request = page.waitForRequest(
      (req) => req.url().includes('/rest/v1/events') && req.url().includes(`date=gte.${today}`)
    );
    await page.goto(`/${CITY}/wydarzenia`);
    const url = new URL((await request).url());
    const dates = url.searchParams.getAll('date');
    expect(dates).toContain(`gte.${today}`);
    // The upper bound is three months on; its exact day depends on month
    // lengths, so only its presence and order are checked here (the unit tests
    // pin the arithmetic).
    const upper = dates.find((d) => d.startsWith('lte.'))?.slice(4) ?? '';
    expect(upper > today).toBe(true);
    // And the URL itself stays clean: the default is not a filter the user set.
    expect(page.url()).not.toMatch(/date(Single|From|To)=/);
  });

  test('"Dziś" picks today, and saving it keeps it relative', async ({ page }) => {
    const today = ymd(new Date());
    await page.goto('/moje-filtry');
    await page.evaluate(() => window.localStorage.clear());

    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);
    await openFilters(page);
    await page.getByRole('button', { name: TEXT.filterDate, exact: true }).click();
    const todayPick = page.getByRole('button', { name: TEXT.filterDateToday, exact: true });
    await todayPick.click();
    await page.waitForURL(new RegExp(`dateSingle=${today}`));
    await expect(todayPick).toHaveAttribute('aria-pressed', 'true');
    await closeFilters(page);

    await page.getByRole('button', { name: TEXT.presetsSaveCurrent }).click();
    await page.getByLabel(TEXT.presetsName).fill('Dziś');
    // Preselected from the dates on screen.
    await expect(page.getByRole('combobox', { name: TEXT.presetsWhen })).toHaveText('Dzisiaj');
    await page.getByRole('button', { name: TEXT.presetsSave, exact: true }).click();

    const stored = await page.evaluate(() => window.localStorage.getItem('go-to-city.presets'));
    const [preset] = JSON.parse(stored ?? '[]');
    expect(preset.filters).toMatchObject({ dateWindow: 'today', dateFrom: null, dateTo: null });
  });
});

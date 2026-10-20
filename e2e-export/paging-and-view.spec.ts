import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// These specs run against the STATIC EXPORT (`next build` + a plain file
// server) — the artifact GitHub Pages actually serves. The regular e2e suite
// drives `next dev`, which has a real server and an RSC endpoint behind it, so
// it is structurally blind to export-only breakage: the App Router pins a
// prerendered page's canonical URL to the query string the document was
// cold-loaded with, and same-route pushes get deduped against it. That shipped
// a list where clicking page 2 snapped the view back to whatever mode the URL
// was loaded with and never left page 1.
//
// Everything here is a URL/DOM-shape assertion, never an event name or count —
// same rule as the dev suite (the data changes daily).
// ─────────────────────────────────────────────────────────────────────────────

const CITY = 'wroclaw';
const LIST = `/${CITY}/wydarzenia/`;

const VIEW_GRID = 'Widok siatki';
const VIEW_LIST = 'Widok listy';
const VIEW_MAP = 'Widok mapy';

type P = import('@playwright/test').Page;

/** Which presentation is on screen right now, read from the rendered markup. */
async function view(page: P): Promise<'grid' | 'row' | 'map'> {
  return page.evaluate(() => {
    if (document.querySelector('.leaflet-container')) return 'map';
    return document.querySelector('[class*="EventRow"]') ? 'row' : 'grid';
  });
}

/** The page number the pagination control considers current. */
async function currentPage(page: P): Promise<string | null> {
  return page.evaluate(
    () => document.querySelector('.MuiPagination-root .Mui-selected')?.textContent ?? null
  );
}

async function gotoList(page: P, query = ''): Promise<void> {
  await page.goto(`${LIST}${query}`);
  await expect(page.locator('article').first()).toBeVisible({ timeout: 20000 });
}

async function goToPage(page: P, n: number): Promise<void> {
  await page.getByRole('button', { name: `Go to page ${n}` }).first().click();
  await expect.poll(() => currentPage(page)).toBe(String(n));
}

test.describe('Static export: paging and view mode stay independent', () => {
  // The exact regression: land on a filtered permalink, change the view, then
  // page. The push used to be replaced by the cold-load query.
  test('paging works after a cold load on a filtered URL', async ({ page }) => {
    await gotoList(page, '?viewMode=row');
    expect(await view(page)).toBe('row');

    await page.getByRole('button', { name: VIEW_GRID }).click();
    await expect.poll(() => view(page)).toBe('grid');

    await goToPage(page, 2);
    expect(await view(page)).toBe('grid');
    expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  });

  test('paging never changes the view mode', async ({ page }) => {
    await gotoList(page, '?viewMode=row');

    await goToPage(page, 2);
    expect(await view(page)).toBe('row');
    await goToPage(page, 3);
    expect(await view(page)).toBe('row');
  });

  test('switching the view mode keeps the current page', async ({ page }) => {
    await gotoList(page, '?page=2');
    expect(await currentPage(page)).toBe('2');

    await page.getByRole('button', { name: VIEW_LIST }).click();
    await expect.poll(() => view(page)).toBe('row');
    expect(await currentPage(page)).toBe('2');

    // The map paginates nothing, so it drops the control — but the page must
    // survive the round trip and still be there on the way back.
    await page.getByRole('button', { name: VIEW_MAP }).click();
    await expect.poll(() => view(page)).toBe('map');
    expect(new URL(page.url()).searchParams.get('page')).toBe('2');

    await page.getByRole('button', { name: VIEW_GRID }).click();
    await expect.poll(() => view(page)).toBe('grid');
    expect(await currentPage(page)).toBe('2');
  });

  // Page size is the one display control that must reset the page: page 2 of a
  // 15-per-page list is not page 2 of a 30-per-page one.
  test('changing the page size returns to page 1', async ({ page }) => {
    await gotoList(page, '?page=2');

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: '30' }).first().click();

    await expect.poll(() => currentPage(page)).toBe('1');
    expect(new URL(page.url()).searchParams.get('pageSize')).toBe('30');
    await expect(page.locator('article')).toHaveCount(30);
  });

  // A filter change also re-navigates a cold-loaded filtered URL — the same
  // dedupe used to swallow it, freezing the whole list.
  test('a filter applied on a cold-loaded filtered URL lands', async ({ page }) => {
    await gotoList(page, '?viewMode=row');

    await page.getByRole('checkbox').first().click();
    await page.waitForURL(/categories=/, { timeout: 10000 });
    expect(await view(page)).toBe('row');
    expect(new URL(page.url()).searchParams.get('page')).toBeNull();
  });
});

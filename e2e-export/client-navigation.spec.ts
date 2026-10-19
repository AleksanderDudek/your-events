import { test, expect } from '@playwright/test';

// Client-side navigation into a page with build-time data. Clicking a card does
// not load the event's HTML: the router fetches the page's prerendered loader
// data (`<path>/_.data`) and renders it in place. That file only exists if the
// build wrote it under the exact URL the link points at — a mismatch between
// the two is invisible on the dev server, which computes the data on request,
// and turns every card click on the real site into a 404.
//
// Structural assertions only, as everywhere in these suites (data changes
// daily): the detail <h1> must be the card's own title, never the 404 page.

const LIST = '/wroclaw/wydarzenia/';
const PERMALINK = /\/wroclaw\/[a-z0-9-]+\/[a-z0-9-]+-[0-9a-f]{8}\/$/;

test.describe('Static export: client-side navigation', () => {
  test('a card opens its event page without a reload', async ({ page }) => {
    const missing: string[] = [];
    page.on('response', (r) => {
      if (r.url().endsWith('.data') && r.status() >= 400) missing.push(r.url());
    });

    await page.goto(LIST);
    const card = page.locator('a:has(article)').first();
    await expect(card).toBeVisible({ timeout: 20000 });
    const title = (await card.locator('h3').innerText()).trim();

    // A marker on window survives client-side navigation and dies on a reload.
    await page.evaluate(() => ((window as unknown as { __spa: boolean }).__spa = true));
    await card.click();

    await expect(page).toHaveURL(PERMALINK);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(true);
    expect(missing, 'loader data the build did not write').toEqual([]);
  });

  test('a similar-event card navigates from one event page to another', async ({ page }) => {
    await page.goto(LIST);
    await page.locator('a:has(article)').first().click();
    await expect(page).toHaveURL(PERMALINK);

    const rail = page.locator('a:has(article)');
    test.skip((await rail.count()) === 0, 'This event has no similar events to follow');
    const next = rail.first();
    const title = (await next.locator('h3').innerText()).trim();
    await next.click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('404');
  });
});

import { test, expect, type APIRequestContext } from '@playwright/test';

// The whole case for computing "similar events" at build time is that they ship
// as plain HTML: instant, free at runtime, and — the part no other approach can
// give — followable by a crawler. A dev-server test cannot prove that, because
// React hydrates and papers over anything the static markup got wrong.
//
// So this runs against the real export with JavaScript switched off. What
// survives that is what a crawler sees.

const PERMALINK = /\/szczecin\/[a-z0-9-]+\/[a-z0-9-]+-[0-9a-f]{8}$/;

/**
 * A detail page picked the way a crawler finds one — out of the sitemap.
 *
 * Deliberately not by following a link on a hub page: those hrefs are built
 * from a client-side category lookup that is empty during the prerender, so in
 * the static HTML they point at a route that was never generated. Discovering
 * through the sitemap keeps this spec about the rail.
 */
async function someDetailPath(request: APIRequestContext): Promise<string | null> {
  const response = await request.get('/sitemap.xml');
  if (!response.ok()) return null;
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => {
      try {
        return new URL(m[1]).pathname.replace(/\/$/, '');
      } catch {
        return '';
      }
    })
    .filter((p) => PERMALINK.test(p));
  return paths[0] ?? null;
}

test.describe('Static export: similar events', () => {
  test.use({ javaScriptEnabled: false });

  test('the rail is in the served HTML, and its links go somewhere real', async ({
    page,
    request,
  }) => {
    const path = await someDetailPath(request);
    test.skip(!path, 'No event permalinks in the sitemap for this data slice');

    await page.goto(`${path}/`);

    const rail = page.locator('section[aria-labelledby="related-events-title"]');
    // Sparse categories legitimately render no rail — skip rather than fail on
    // an event that has too few neighbours.
    if ((await rail.count()) === 0) {
      test.skip(true, 'This event has no similar events to show');
    }

    await expect(rail.locator('h2')).toHaveText('Podobne wydarzenia');
    const links = rail.locator('li a');
    expect(await links.count()).toBeGreaterThanOrEqual(4);

    // Every suggestion must resolve. The hrefs are built from the build-time
    // category map precisely because the client-side one is empty during the
    // prerender, which would send each of them to a page that does not exist.
    const targets = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute('href') ?? '')
    );
    for (const target of targets.slice(0, 5)) {
      const response = await request.get(target);
      expect(response.status(), `${target} did not resolve`).toBeLessThan(400);
    }

    // And none of them is the page we are standing on.
    const self = new URL(page.url()).pathname.replace(/\/$/, '');
    expect(targets.some((t) => t.replace(/\/$/, '') === self)).toBe(false);
  });

  test('the same repeating class does not fill the rail', async ({ page, request }) => {
    // Weekly classes are dozens of near-identical rows; without collapsing them
    // the highest-scoring suggestions are all one class, which reads as broken.
    const path = await someDetailPath(request);
    test.skip(!path, 'No event permalinks in the sitemap for this data slice');

    await page.goto(`${path}/`);
    const rail = page.locator('section[aria-labelledby="related-events-title"]');
    if ((await rail.count()) === 0) test.skip(true, 'No rail on this event');

    const titles = await rail
      .locator('li h3')
      .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
    expect(titles.length).toBeGreaterThan(0);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

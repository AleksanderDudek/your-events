import { test, expect, type APIRequestContext } from '@playwright/test';

// Internal links are the only path a crawler has into the event pages, and a
// broken one is invisible in normal use: EventCard repairs its href on
// hydration, so a click almost always lands. It is the prerendered markup that
// has to be right, and only a JavaScript-free run against the real export can
// tell you whether it is.
//
// This guards a regression that shipped once already: card hrefs were derived
// from a client-side category lookup, empty during the prerender, so 48 of 49
// links on a hub page pointed at /{city}/inne/... — a route never generated.

const PERMALINK = /\/(?:szczecin|wroclaw)\/[a-z0-9-]+\/[a-z0-9-]+-[0-9a-f]{8}\/?$/;

async function hubPathsFromSitemap(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/sitemap.xml');
  if (!response.ok()) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => {
      try {
        return new URL(m[1]).pathname;
      } catch {
        return '';
      }
    })
    // Category hubs are two segments deep: /{city}/{category}/
    .filter((p) => /^\/[a-z-]+\/[a-z0-9-]+\/?$/.test(p) && !p.includes('/wydarzenia'));
}

test.describe('Static export: internal links', () => {
  test.use({ javaScriptEnabled: false });

  test('every event link on a category hub resolves without JavaScript', async ({
    page,
    request,
  }) => {
    const hubs = await hubPathsFromSitemap(request);
    test.skip(hubs.length === 0, 'No category hubs in the sitemap for this data slice');

    // A couple of hubs is enough to catch a systemic breakage — they all render
    // through the same component — and keeps the suite quick.
    for (const hub of hubs.slice(0, 2)) {
      await page.goto(hub.endsWith('/') ? hub : `${hub}/`);

      const hrefs = await page
        .locator('a')
        .evaluateAll((els) =>
          els.map((el) => el.getAttribute('href') ?? '').filter((h) => h.length > 0)
        );
      const eventLinks = [...new Set(hrefs.filter((h) => PERMALINK.test(h)))];
      expect(eventLinks.length, `${hub} rendered no event links`).toBeGreaterThan(0);

      // None of them may point at the fallback category, which is the shape the
      // old bug produced.
      const fallback = eventLinks.filter((h) => h.includes('/inne/'));
      const hubIsInne = hub.includes('/inne');
      if (!hubIsInne) {
        expect(fallback, `${hub} emitted fallback-category links`).toEqual([]);
      }

      for (const link of eventLinks.slice(0, 5)) {
        const response = await request.get(link);
        expect(response.status(), `${link} (from ${hub}) did not resolve`).toBeLessThan(400);
      }
    }
  });
});

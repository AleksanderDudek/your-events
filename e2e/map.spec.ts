import { test, expect } from '@playwright/test';
import { TEXT, CITY } from './support/helpers';

const PERMALINK = new RegExp(`/${CITY}/[a-z0-9-]+/[a-z0-9-]+-[0-9a-f]{8}/?$`);

// Guards commit 3341414 (map pin-popup routing). The popup's CTA is raw HTML
// injected into a Leaflet popup — it lives OUTSIDE React, so only a real
// end-to-end click can prove its href routes to the correct permalink. A unit
// test can't reach it.
// The marker artwork is built as raw markup and handed to Leaflet, then styled
// against markercluster's own stylesheet. Both of those only resolve in a real
// browser, so the unit tests around markerVisuals cannot prove what actually
// lands on the map — these can.
test.describe('Map: markers carry their category', () => {
  test('pins are drawn with their category glyph', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?viewMode=map&pageSize=60`);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });

    const marker = page.locator('.leaflet-marker-icon:not(.marker-cluster)').first();
    const cluster = page.locator('.marker-cluster').first();
    await expect(marker.or(cluster).first()).toBeVisible({ timeout: 20000 });

    if (!(await marker.isVisible().catch(() => false))) {
      test.skip(true, 'Everything is clustered for this data slice');
    }

    // A tinted teardrop with a glyph inside it, not the old plain white dot.
    const pinSvg = marker.locator('svg');
    await expect(pinSvg).toBeVisible();
    await expect(pinSvg.locator('path, circle, rect, line').first()).toBeAttached();
    expect(await pinSvg.locator('path, circle, rect, line').count()).toBeGreaterThan(1);
  });

  test('cluster bubbles show a count, and a glyph when they hold one category', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?viewMode=map&pageSize=60`);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });

    const cluster = page.locator('.marker-cluster').first();
    if (!(await cluster.isVisible({ timeout: 20000 }).catch(() => false))) {
      test.skip(true, 'Nothing clustered for this data slice');
    }

    // Every bubble states how many events it holds.
    await expect(cluster.locator('span')).toHaveText(/^\d+$/);

    // Single-category bubbles also carry the glyph — and it must have a painted
    // box, not merely exist: markercluster's own `span { line-height: 30px }`
    // once collapsed it to zero inside the flex bubble.
    const glyphs = page.locator('.marker-cluster svg');
    if ((await glyphs.count()) > 0) {
      const box = await glyphs.first().boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(8);
    }
  });
});

test.describe('Map: shows every match, not one page of them', () => {
  test('renders far more events than the page size allows', async ({ page }) => {
    // The map used to render whatever page the list was on, so a city with
    // hundreds of matches showed at most `pageSize` pins. Counting what the
    // clusters say they hold is the only way to see that from the outside.
    await page.goto(`/${CITY}/wydarzenia?viewMode=map&pageSize=15`);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('.marker-cluster, .leaflet-marker-icon').first()).toBeVisible({
      timeout: 25000,
    });

    const represented = await page.evaluate(() => {
      const clustered = Array.from(document.querySelectorAll('.marker-cluster span')).reduce(
        (sum, el) => sum + Number(el.textContent || 0),
        0
      );
      const single = document.querySelectorAll(
        '.leaflet-marker-icon:not(.marker-cluster)'
      ).length;
      return clustered + single;
    });

    const resultText = await page.getByText(TEXT.resultsCount).first().textContent();
    const total = Number(resultText?.match(/\d+/)?.[0] ?? 0);
    // Data-independent: assert against the page size and the real total rather
    // than a pin count that changes with every scrape.
    test.skip(total <= 15, 'Not enough events in this slice to tell the two apart');
    expect(represented).toBeGreaterThan(15);
    expect(represented).toBeLessThanOrEqual(total);
  });

  test('says how many results could not be placed', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?viewMode=map`);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(TEXT.resultsCount).first()).toBeVisible({ timeout: 25000 });

    // Only shown when some matches genuinely lack coordinates — otherwise there
    // is nothing to explain.
    const note = page.getByText(/Na mapie: \d+ z \d+/);
    if ((await note.count()) > 0) {
      const text = (await note.first().textContent()) ?? '';
      const [shown, total] = [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
      expect(shown).toBeLessThan(total);
    }
  });
});

test.describe('Map: pin → popup → detail', () => {
  test('a marker popup routes to that event\'s detail page', async ({ page }) => {
    // Deep-link straight into the map view. Narrowing the list by a term taken
    // from the first card (the previous approach) coupled the test to the day's
    // data: online-only events carry no coordinates, so whenever one happened to
    // lead the list the map legitimately rendered "no pins" and the test failed
    // on the scrape rather than on a regression.
    await page.goto(`/${CITY}/wydarzenia?viewMode=map`);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });

    const pin = page.locator('.leaflet-marker-icon:not(.marker-cluster)').first();
    const cluster = page.locator('.marker-cluster').first();

    // Markers only mount once the events query resolves.
    await expect(pin.or(cluster).first()).toBeVisible({ timeout: 20000 });

    // Pins normally start clustered, and clicking a cluster zooms instead of
    // opening a popup. Drill in until a single marker surfaces — markercluster
    // spiderfies at max zoom, so this terminates even for events sharing a venue.
    for (let i = 0; i < 8; i++) {
      if (await pin.isVisible().catch(() => false)) break;
      if (!(await cluster.isVisible().catch(() => false))) break;
      await cluster.click();
      await page.waitForTimeout(700); // zoom + cluster animation
    }

    // If everything is still clustered, skip rather than flake — clustering
    // geometry depends on the day's data, not on a regression.
    if (!(await pin.isVisible().catch(() => false))) {
      test.skip(true, 'No un-clustered pin for this data slice');
    }
    await pin.click();

    // The popup opens with the "Zobacz wydarzenie" CTA anchor.
    const cta = page.locator('.leaflet-popup').getByText(TEXT.mapPopupCta);
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();

    await expect(page).toHaveURL(PERMALINK);
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  });
});

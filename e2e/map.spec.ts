import { test, expect } from '@playwright/test';
import { TEXT, CITY } from './support/helpers';

const PERMALINK = new RegExp(`/${CITY}/[a-z0-9-]+/[a-z0-9-]+-[0-9a-f]{8}/?$`);

// Guards commit 3341414 (map pin-popup routing). The popup's CTA is raw HTML
// injected into a Leaflet popup — it lives OUTSIDE React, so only a real
// end-to-end click can prove its href routes to the correct permalink. A unit
// test can't reach it.
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

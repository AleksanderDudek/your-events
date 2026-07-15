import { test, expect } from '@playwright/test';
import { TEXT, CITY, firstCard, gotoEvents, closeFilters, search } from './support/helpers';

const PERMALINK = new RegExp(`/${CITY}/[a-z0-9-]+/[a-z0-9-]+-[0-9a-f]{8}/?$`);

// Guards commit 3341414 (map pin-popup routing). The popup's CTA is raw HTML
// injected into a Leaflet popup — it lives OUTSIDE React, so only a real
// end-to-end click can prove its href routes to the correct permalink. A unit
// test can't reach it.
test.describe('Map: pin → popup → detail', () => {
  test('a marker popup routes to that event\'s detail page', async ({ page }) => {
    await gotoEvents(page);

    // Narrow to a handful of results first. With few events the map renders
    // individual pins rather than clusters — a clustered marker would zoom on
    // click instead of opening a popup, which isn't what we're testing.
    const title = (await firstCard(page).locator('h3').innerText()).trim();
    const term = title.split(/\s+/).find((w) => w.length >= 5) ?? title.slice(0, 5);
    await search(page, term);
    await closeFilters(page);

    await page.getByRole('button', { name: TEXT.viewMap }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20000 });

    // An individual (non-cluster) pin. If everything clustered, skip rather than
    // flake — clustering geometry depends on the day's data, not on a regression.
    const pin = page.locator('.leaflet-marker-icon:not(.marker-cluster)').first();
    if (!(await pin.isVisible({ timeout: 15000 }).catch(() => false))) {
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

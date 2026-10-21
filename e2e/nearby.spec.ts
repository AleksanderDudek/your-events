import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  CITY,
  TEXT,
  activeChip,
  closeFilters,
  openFilters,
  skipFirstVisitPrompts,
  waitForList,
} from './support/helpers';

// Wrocław's Rynek. As everywhere in this suite, nothing asserts what the
// scrape put near it — only that the filter is applied and honoured.
const RYNEK = { lat: 51.11, lng: 17.032 };

// The first-visit prompts are not what this suite is about.
test.beforeEach(async ({ page }) => {
  await skipFirstVisitPrompts(page);
});

async function openNearby(page: Page): Promise<void> {
  await openFilters(page);
  await page.getByRole('button', { name: TEXT.nearSection }).click();
}

/** Every card's stated distance, in metres, in list order. */
async function cardDistances(page: Page): Promise<number[]> {
  const texts = await page.locator('article').allInnerTexts();
  return texts.flatMap((text) => {
    const match = text.match(/(\d+(?:,\d)?)\s(k?m)(?![a-z])/);
    if (!match) return [];
    const value = Number(match[1].replace(',', '.'));
    return [match[2] === 'km' ? value * 1000 : value];
  });
}

test.describe('Events near a point', () => {
  test('"use my location" filters around the device, coarsened to ~100 m', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.109_87, longitude: 17.032_41 });
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);
    await openNearby(page);

    await page.getByRole('button', { name: TEXT.nearUseMyLocation }).click();

    await expect(page).toHaveURL(/[?&]near=51\.11%2C17\.032(&|$)/);
    await expect(page).toHaveURL(/[?&]radius=1000(&|$)/);
    await closeFilters(page);
    await expect(activeChip(page, TEXT.nearMyLocation)).toBeVisible();
  });

  test('an address picked from the suggestions becomes the point', async ({ page }) => {
    // Photon is a third party: stubbed, so this suite never depends on it.
    await page.route(/photon\.komoot\.io\/api/, (route) =>
      route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [17.0322, 51.1069] },
              properties: {
                osm_type: 'W',
                osm_id: 101136527,
                street: 'Świdnicka',
                housenumber: '12',
                district: 'Stare Miasto',
                city: 'Wrocław',
              },
            },
          ],
        },
      })
    );
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);
    await openNearby(page);

    await page.getByRole('combobox', { name: TEXT.nearAddress }).fill('Świdnicka 12');
    await page.getByRole('option', { name: /Świdnicka 12/ }).click();

    await expect(page).toHaveURL(/[?&]near=51\.1069%2C17\.0322(&|$)/);
    await expect(page).toHaveURL(/[?&]nearLabel=%C5%9Awidnicka\+12(&|$)/);
    // An Escape that lands while the suggestions are still closing is spent on
    // them, not on the drawer closeFilters is trying to shut.
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await closeFilters(page);
    await expect(activeChip(page, /Świdnicka 12/)).toBeVisible();
  });

  test('a shared link restores the filter, and no card is past the radius', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?near=${RYNEK.lat},${RYNEK.lng}&radius=1500`);
    await waitForList(page);

    // Someone else's location is never called "yours".
    await expect(activeChip(page, /W promieniu 1,5\skm: Wybrany punkt/)).toBeVisible();
    for (const distance of await cardDistances(page)) {
      expect(distance).toBeLessThanOrEqual(1500);
    }
  });

  test('sorting by distance puts the nearest first', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?near=${RYNEK.lat},${RYNEK.lng}&radius=3000&sort=distance`);
    await waitForList(page);

    const distances = await cardDistances(page);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  // The picker is a dialog full of Leaflet, which the unit tests replace with a
  // stand-in — only a real browser shows what lands in it. Same gate as
  // a11y.spec: serious and critical only, minus the two design-owned rules.
  test('the map picker has no serious accessibility violations', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?near=${RYNEK.lat},${RYNEK.lng}&radius=1500`);
    await waitForList(page);
    await openNearby(page);
    await page.getByRole('button', { name: TEXT.nearPickOnMap }).click();
    // The pin is drawn once the lazily loaded map has mounted.
    await expect(page.locator('.MuiDialog-root .leaflet-marker-icon').first()).toBeAttached({
      timeout: 20000,
    });

    const { violations } = await new AxeBuilder({ page })
      .include('.MuiDialog-root')
      .disableRules(['color-contrast', 'region'])
      .analyze();
    const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('the map draws the circle', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?near=${RYNEK.lat},${RYNEK.lng}&radius=2000&viewMode=map`);
    // The map replaces the empty state only once its own query has answered;
    // the result count is no signal, since it reads 0 until then.
    const map = page.locator('.leaflet-container');
    await expect(map.or(page.getByText(TEXT.emptyTitle))).toBeVisible({ timeout: 25000 });
    test.skip(!(await map.isVisible()), 'Nothing within 2 km of the Rynek in this data slice');

    // The circle is an SVG path in Leaflet's overlay pane.
    await expect(page.locator('.leaflet-overlay-pane path').first()).toBeAttached({
      timeout: 20000,
    });
  });
});

import { test, expect } from '@playwright/test';
import { TEXT, CITY } from './support/helpers';

// The city landing page is that city's front door: hero + quick-filter tiles
// that deep link into the pre-filtered events list. The root "/" is now a
// separate city picker (see city-picker.spec.ts) — landing content lives at
// /{city}.
test.describe('City landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${CITY}`);
  });

  test('renders the hero prompt and headline', async ({ page }) => {
    // .first(): the hero lives inside the page's <Suspense> boundary, which can
    // momentarily stream a duplicate node during dev-server hydration. The
    // header (in the layout, outside Suspense) never does. Production SSR = 1.
    await expect(page.getByText(TEXT.heroPrompt).first()).toBeVisible();
    // Headline text is split across spans; the accessible name is the source of
    // truth ("Idź na <miasto|city>").
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/Idź na/);
  });

  test('header exposes the brand and primary navigation', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('banner').getByText('Idź na miasto')).toBeVisible();
  });

  test('"browse all events" CTA navigates to the events list', async ({ page }) => {
    await page.getByRole('link', { name: TEXT.browseAll }).click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia`));
  });

  test('a quick-filter tile deep links into the filtered list', async ({ page }) => {
    // Tiles upgrade their href from the plain list-URL fallback to a
    // date-filtered URL after hydration; either way they land on the events
    // list for the current city.
    const tile = page.locator('a', { hasText: 'Co się dzieje teraz na mieście?' }).first();
    await expect(tile).toBeVisible();
    await tile.click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia`));
  });
});

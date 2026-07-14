import { test, expect } from '@playwright/test';
import { TEXT, CITY, firstCard, gotoEvents } from './support/helpers';

// The permalink shape: /{city}/{category}/{name}-{shortid}. Not anchored at
// the start: toHaveURL matches against the full URL (including
// origin/protocol), whereas the href-attribute check in events-list.spec.ts
// matches a bare path, so it anchors with `^/` instead.
const PERMALINK = new RegExp(`/${CITY}/[a-z0-9-]+/[a-z0-9-]+-[0-9a-f]{8}/?$`);

// The detail page is server-rendered from Supabase (fetchEvent) with a
// client-hydrated view. We discover a real event from the list at runtime
// rather than hardcoding an id, so the suite survives the daily data refresh.
test.describe('Event detail', () => {
  test('opens the detail page from a card and shows its title', async ({ page }) => {
    await gotoEvents(page);
    const card = firstCard(page);
    // The card's <h3> title should match the detail page <h1>.
    const title = (await card.locator('h3').innerText()).trim();

    await card.click();
    await expect(page).toHaveURL(PERMALINK);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  });

  test('renders the core detail fields (title + venue)', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page).toHaveURL(PERMALINK);

    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
    // "Lokalizacja" label + a non-empty venue value are always present.
    await expect(page.getByText('Lokalizacja')).toBeVisible();
  });

  test('back button returns to the events list', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page).toHaveURL(PERMALINK);

    await page.getByRole('button', { name: TEXT.back }).click();
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia`));
  });

  test('external ticket link opens safely in a new tab', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page).toHaveURL(PERMALINK);

    // The "Visit website" link only renders when the event has a source URL —
    // skip cleanly when this particular event has none.
    const link = page.getByRole('link', { name: TEXT.externalLink });
    if ((await link.count()) === 0) {
      test.skip(true, 'Event has no external ticket URL');
    }
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  // NOTE: 404 handling for a non-existent id is intentionally NOT covered here.
  // These tests run against `next dev`, where rendering the not-found boundary
  // trips a Turbopack "Could not parse module next/document" error and returns
  // HTTP 500. In the production static export (what GitHub Pages serves) the
  // missing route falls back to a static 404 page, so this is a dev-server-only
  // artifact — asserting on it would be a false alarm, not a real signal.
});

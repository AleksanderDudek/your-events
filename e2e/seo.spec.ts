import { test, expect } from '@playwright/test';
import { TEXT, CITY, firstCard, gotoEvents } from './support/helpers';

// Metadata is invisible to users but load-bearing for search/social (commit
// 2b081a9). generateMetadata runs per-route, so these assert the rendered <head>
// rather than any component. We match the page-specific part of each value, not
// the whole string, so the brand title-template can change freely.
test.describe('SEO metadata', () => {
  test('events list exposes title, canonical, description and og:title', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);

    await expect(page).toHaveTitle(TEXT.metaEventsTitle);
    // Canonical is an absolute SITE_URL; assert the path tail (host-independent
    // — SITE_URL's origin/basePath differ between demo and prod builds).
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/wroclaw\/wydarzenia/
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /.+/
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      TEXT.metaEventsTitle
    );
  });

  test('event detail has a per-event title and canonical', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();

    // Detail title is `${name} — ${date}` (+ brand template) — the em-dash is a
    // stable structural marker without hardcoding a specific event.
    await expect(page).toHaveTitle(/—/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/${CITY}/[a-z0-9-]+/[a-z0-9-]+-[0-9a-f]{8}`)
    );
  });
});

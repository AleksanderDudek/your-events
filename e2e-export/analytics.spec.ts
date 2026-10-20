import { test, expect } from '@playwright/test';

// The Microsoft Clarity tag must ship ONLY in the Pages deploy build, which is
// the one place NEXT_PUBLIC_CLARITY_PROJECT_ID is set. Every other build runs
// the same app under a robot: `next dev` behind the main Playwright config, and
// this static export behind the current one. While the tag was unconditional,
// each test's page-load opened its own Clarity session — hundreds of ~1s
// recordings pointing at localhost, whose CSS Clarity's replay can never fetch,
// drowning the real traffic in the dashboard.
//
// This suite builds with the id unset, so a tag in the served HTML means the
// gate is gone. Guarding the markup (not the runtime) also catches the case
// where the script is present but silently no-ops.

const PAGES = ['/', '/wroclaw/wydarzenia/'];

test.describe('Static export: analytics gating', () => {
  for (const path of PAGES) {
    test(`${path} carries no Clarity tag when the project id is unset`, async ({
      request,
    }) => {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);

      const html = await response.text();
      expect(html).not.toContain('clarity.ms');
      expect(html).not.toContain('ms-clarity');
    });
  }
});

test.describe('Static export: consent banner', () => {
  test.use({ javaScriptEnabled: false });

  test('the banner is not in the prerendered HTML', async ({ page }) => {
    // With JavaScript off nothing hydrates, so this asserts the bytes on disk.
    // A banner visible here would have shipped in all 1000+ prerendered pages
    // and flashed at every visitor who had already answered.
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Zgoda na cookies' })).toHaveCount(0);
  });
});

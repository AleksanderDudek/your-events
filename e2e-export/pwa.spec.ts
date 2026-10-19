import { test, expect, type Page } from '@playwright/test';

// The PWA layer only exists in the build — the dev server registers no service
// worker — so this suite is where it is checked: installable (manifest +
// icons), controlled by the service worker, and still useful offline.
//
// Served at the domain root here (VITE_BASE_PATH=''), so every URL below is
// root-relative.

/** Resolves once a service worker controls the page. */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
}

test.describe('Static export: installable app', () => {
  test('ships a web app manifest whose icons all resolve', async ({ request, baseURL }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    const manifest = await response.json();

    expect(manifest.name).toBe('Idź na miasto');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');

    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      // Icon paths are relative to the manifest, wherever it is served from.
      const url = new URL(icon.src, `${baseURL}/manifest.webmanifest`).toString();
      expect((await request.get(url)).ok(), url).toBe(true);
    }
  });

  test('every page links the manifest exactly once', async ({ page }) => {
    await page.goto('/wroclaw/wydarzenia/');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  });
});

test.describe('Static export: offline', () => {
  test('a service worker takes control of the page', async ({ page }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
  });

  test('a page visited before still opens without a connection', async ({ page, context }) => {
    await page.goto('/wroclaw/');
    await waitForServiceWorker(page);
    // The first load happened before the worker existed; this one goes through
    // it and is cached on the way.
    await page.goto('/wroclaw/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Jesteś offline')).toHaveCount(0);
  });

  test('a page never visited falls back to the offline page, not the browser’s', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.goto('/rozwijaj-z-nami/');
    await expect(page.getByRole('heading', { name: 'Jesteś offline' })).toBeVisible();
  });
});

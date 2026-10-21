import { test, expect, type Page } from '@playwright/test';
import { CONSENT_STORAGE_KEY } from '../src/lib/consent';
import { ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION } from '../src/lib/onboarding';
import { CITY, TEXT, openFilters, waitForList } from './support/helpers';

// The phone layout: the search box on the page, a labelled trigger, a sheet
// that closes with a swipe. Desktop has none of it.
test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone layout only');
  // Answer both first-visit prompts up front: the cookie banner sits over the
  // trigger, and the onboarding sheet opens the moment it is answered.
  await page.addInitScript(
    ([consentKey, onboardingKey, version]) => {
      window.localStorage.setItem(consentKey, 'rejected');
      window.localStorage.setItem(onboardingKey, version);
    },
    [CONSENT_STORAGE_KEY, ONBOARDING_STORAGE_KEY, String(ONBOARDING_VERSION)] as const
  );
});

/**
 * A finger dragging down: real touch input through the DevTools protocol,
 * which is what MUI's swipe handling listens for (mouse events are not).
 */
async function swipeDown(page: Page, from: { x: number; y: number }, distance: number) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 10;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x, y: from.y + (distance * i) / steps }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.describe('Filters on a phone', () => {
  test('the search box is on the page, no drawer needed', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);

    const box = page.getByPlaceholder(TEXT.searchPlaceholder);
    await expect(box).toBeVisible();
    await box.fill('koncert');

    await page.waitForURL(/[?&]search=koncert/, { timeout: 10000 });
    await expect(page.locator('.MuiDrawer-paper')).toBeHidden();
  });

  test('the filters button is labelled and thumb-sized', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);

    const trigger = page.getByRole('button', { name: /^Filtry/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Filtry');
    expect((await trigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  });

  test('a downward swipe on the sheet closes it', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForList(page);
    await openFilters(page);

    const handle = page.locator('.MuiDrawer-paper [class*="dragHandle"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('The drawer has no drag handle');
    await swipeDown(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 400);

    await expect(page.locator('.MuiDrawer-root .MuiBackdrop-root')).toBeHidden();
  });
});

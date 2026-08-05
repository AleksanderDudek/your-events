import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CITY, TEXT } from './support/helpers';

// First-run onboarding. Every test starts from a browser that has never been
// here (Playwright gives each test a fresh context), which is the only state
// this feature reacts to.
//
// The cookie banner comes first by design — onboarding stays closed until a
// consent choice exists — so answering it is the precondition for everything
// below, not incidental setup.

const sheet = (page: Page) => page.getByRole('heading', { name: TEXT.onboardingTitle });

// Hydration signal, deliberately NOT the result count: onboarding has nothing
// to do with whether events loaded, and gating on live data would make this
// suite fail for reasons that have nothing to do with the feature. The cookie
// banner is client-rendered from localStorage alone, so its appearance means
// "the client tree is alive" and nothing more.
const banner = (page: Page) => page.getByRole('region', { name: TEXT.cookieRegion });

async function waitForHydration(page: Page): Promise<void> {
  await expect(banner(page)).toBeVisible({ timeout: 20000 });
}

// After a consent choice the banner is gone, so there is no positive signal
// left to wait on — and the assertion that follows a reload is a negative one
// ("the sheet does not come back"). A fixed settle is the honest tool here: it
// gives hydration room to run and open the sheet if the stored state were
// wrong. A slow machine makes this MORE likely to pass, never flakier, so the
// test is paired with a positive check elsewhere that the sheet can still be
// summoned at all.
async function waitForSettled(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
}

async function arriveAsNewVisitor(page: Page): Promise<void> {
  await page.goto(`/${CITY}/wydarzenia`);
  await waitForHydration(page);
  await page.getByRole('button', { name: TEXT.cookieAccept }).click();
}

test.describe('First-run onboarding', () => {
  test('greets a new visitor once the cookie choice is made', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    await waitForHydration(page);

    // Not before: two stacked overlays is exactly what the sequencing avoids.
    await expect(sheet(page)).toBeHidden();

    await page.getByRole('button', { name: TEXT.cookieAccept }).click();
    await expect(sheet(page)).toBeVisible();
  });

  test('a skip is remembered across a reload', async ({ page }) => {
    await arriveAsNewVisitor(page);
    await page.getByRole('button', { name: TEXT.onboardingSkip }).click();
    await expect(sheet(page)).toBeHidden();

    await page.reload();
    await waitForSettled(page);
    await expect(sheet(page)).toBeHidden();
  });

  test('"show me" spotlights the search box and steps through to the end', async ({ page }) => {
    await arriveAsNewVisitor(page);
    await page.getByRole('button', { name: TEXT.onboardingStart }).click();

    const tour = page.getByRole('dialog');
    await expect(tour).toBeVisible();
    await expect(tour.getByText(TEXT.onboardingStepCount)).toBeVisible();

    // Which step comes first is a property of the layout, not of the tour: on a
    // phone the search box lives inside the closed filter drawer, so that
    // anchor does not exist and the walkthrough opens on the filter Fab.
    const isDesktop = (page.viewportSize()?.width ?? 0) >= 900;
    await expect(
      tour.getByText(isDesktop ? TEXT.onboardingFirstStep : TEXT.onboardingFirstStepMobile)
    ).toBeVisible();

    // Whatever it points at has to be on screen — the regression that mobile
    // caught was a tooltip positioned off the right edge of the viewport.
    const box = await tour.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);

    // Walk to the last step, however many the viewport turns out to have —
    // mobile drops the desktop-only presets step, so the count is not fixed.
    const next = page.getByRole('button', { name: TEXT.onboardingNext });
    while (await next.isVisible().catch(() => false)) {
      await next.click();
    }
    await page.getByRole('button', { name: TEXT.onboardingDone }).click();
    await expect(tour).toBeHidden();

    // Finishing counts as seen.
    await page.reload();
    await waitForSettled(page);
    await expect(sheet(page)).toBeHidden();
  });

  test('Escape ends the tour and still counts as seen', async ({ page }) => {
    await arriveAsNewVisitor(page);
    await page.getByRole('button', { name: TEXT.onboardingStart }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.reload();
    await waitForSettled(page);
    await expect(sheet(page)).toBeHidden();
  });

  test('the footer link replays it', async ({ page }) => {
    await arriveAsNewVisitor(page);
    await page.getByRole('button', { name: TEXT.onboardingSkip }).click();
    await expect(sheet(page)).toBeHidden();

    await page.getByRole('button', { name: TEXT.onboardingFooterLink }).click();
    await expect(sheet(page)).toBeVisible();
  });

  test('stays off the city picker', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(TEXT.cityPickerTitle)).toBeVisible();
    await page.getByRole('button', { name: TEXT.cookieAccept }).click();
    await expect(sheet(page)).toBeHidden();
  });

  test('the welcome sheet has no serious accessibility violations', async ({ page }) => {
    await arriveAsNewVisitor(page);
    await expect(sheet(page)).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .disableRules(['color-contrast', 'region'])
      .analyze();
    const serious = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(
      serious,
      serious.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('\n')
    ).toEqual([]);
  });
});

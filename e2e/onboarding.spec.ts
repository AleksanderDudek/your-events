import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CITY, TEXT } from './support/helpers';
import { CONSENT_STORAGE_KEY } from '../src/lib/consent';

// First-run onboarding. Every test starts from a browser that has never been
// here (Playwright gives each test a fresh context), which is the only state
// this feature reacts to.
//
// Since 8.11.2026 the welcome sheet no longer waits for the cookie banner: it
// opens on any city page as a modal over it, whatever the consent choice, and
// either of its buttons leads to a notification step ("Nie teraz" / "Włącz
// powiadomienia") before the page is the visitor's again.

const sheet = (page: Page) => page.getByRole('heading', { name: TEXT.onboardingTitle });
const tour = (page: Page) => page.getByRole('dialog');

// Hydration signal where no sheet is expected, deliberately NOT the result
// count: onboarding has nothing to do with whether events loaded, and gating on
// live data would make this suite fail for reasons that have nothing to do with
// the feature. The cookie banner is client-rendered from localStorage alone, so
// its appearance means "the client tree is alive" and nothing more. (Under an
// open sheet the banner is aria-hidden; there the sheet itself is the signal.)
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
  await expect(sheet(page)).toBeVisible({ timeout: 20000 });
}

/**
 * "Nie teraz" on the notification step that follows the welcome buttons. A
 * browser with nothing to offer settles that step on its own, so it may never
 * show — waited for briefly, then carried on without.
 */
async function answerReminderStep(page: Page): Promise<void> {
  const notNow = page.getByRole('button', { name: TEXT.reminderNotNow });
  const shown = await notNow
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (shown) await notNow.click();
}

async function startStory(page: Page): Promise<void> {
  await arriveAsNewVisitor(page);
  await page.getByRole('button', { name: TEXT.onboardingStart }).click();
  await answerReminderStep(page);
  await expect(tour(page)).toBeVisible();
}

/** Advance to the step with this title. */
async function stepTo(page: Page, title: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: TEXT.onboardingNext }).click();
  await expect(tour(page).getByRole('heading', { name: title })).toBeVisible();
}

async function savedPresets(page: Page) {
  const raw = await page.evaluate(() => window.localStorage.getItem('go-to-city.presets'));
  return raw ? (JSON.parse(raw) as { name: string; filters: { hourFrom: string } }[]) : [];
}

test.describe('First-run onboarding', () => {
  test('greets a new visitor whether or not the cookie banner is answered', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia`);
    // The banner is still unanswered underneath: the sheet does not wait for it.
    await expect(sheet(page)).toBeVisible({ timeout: 20000 });
    const consent = await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_STORAGE_KEY);
    expect(consent).toBeNull();
  });

  test('a skip is remembered across a reload', async ({ page }) => {
    await arriveAsNewVisitor(page);
    await page.getByRole('button', { name: TEXT.onboardingSkip }).click();
    await answerReminderStep(page);
    await expect(sheet(page)).toBeHidden();

    await page.reload();
    await waitForSettled(page);
    await expect(sheet(page)).toBeHidden();
  });

  // The whole point of the story: the app really does the thing it describes.
  test('builds the filters, saves them, revisits and edits the preset', async ({ page }) => {
    await startStory(page);
    await expect(tour(page).getByText(TEXT.onboardingStepCount)).toBeVisible();

    // 1–3: the filter set is built in front of the visitor and lands in the URL.
    await stepTo(page, TEXT.storyWeekdays);
    await stepTo(page, TEXT.storyHours);
    // toHaveURL, not waitForURL: the filter writes are history.pushState +
    // popstate (see useFilterNavigation), which fires no navigation event for
    // waitForURL to observe. toHaveURL polls the address instead.
    await expect(page).toHaveURL(/categories=/);
    await expect(page).toHaveURL(/weekdays=/);
    await expect(page).toHaveURL(/hourFrom=16/);

    // 4–5: results, then the set is saved as a preset the visitor keeps.
    await stepTo(page, TEXT.storyResults);
    await stepTo(page, TEXT.storySave);
    await expect.poll(() => savedPresets(page).then((p) => p.length)).toBe(1);
    expect((await savedPresets(page))[0].name).toBe(TEXT.storyPresetName);

    // 6: over to Moje filtry, where the saved sets live.
    await stepTo(page, TEXT.storyPresets);
    await expect(page).toHaveURL(/\/moje-filtry\//);

    // 7: opening the preset puts those filters back on the list.
    await stepTo(page, TEXT.storyOpen);
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia/\\?`));
    await expect(page).toHaveURL(/hourFrom=16/);

    // 8: the job changed — the saved preset moves to the later hour.
    await stepTo(page, TEXT.storyEdit);
    await expect(page).toHaveURL(/\/moje-filtry\//);
    await expect.poll(() => savedPresets(page).then((p) => p[0].filters.hourFrom)).toBe('18:00');
    expect(await savedPresets(page)).toHaveLength(1);

    // 9: and the new hours are one click away, exactly like the old ones.
    await stepTo(page, TEXT.storyEdited);
    await expect(page).toHaveURL(new RegExp(`/${CITY}/wydarzenia/\\?`));
    await expect(page).toHaveURL(/hourFrom=18/);

    await page.getByRole('button', { name: TEXT.onboardingDone }).click();
    await expect(tour(page)).toBeHidden();

    // Finishing counts as seen.
    await page.reload();
    await waitForSettled(page);
    await expect(sheet(page)).toBeHidden();
  });

  test('Escape ends the story and still counts as seen', async ({ page }) => {
    await startStory(page);
    await page.keyboard.press('Escape');
    await expect(tour(page)).toBeHidden();

    await page.reload();
    await waitForSettled(page);
    await expect(sheet(page)).toBeHidden();
  });

  test('the footer link replays it', async ({ page }) => {
    await arriveAsNewVisitor(page);
    await page.getByRole('button', { name: TEXT.onboardingSkip }).click();
    await answerReminderStep(page);
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

  // Someone who followed a shared filter link came for those results, not for
  // an introduction that would overwrite them.
  test('stays quiet for a visitor who arrived on a filter link', async ({ page }) => {
    await page.goto(`/${CITY}/wydarzenia?categories=muzyka`);
    await waitForHydration(page);
    await page.getByRole('button', { name: TEXT.cookieAccept }).click();
    await waitForSettled(page);
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

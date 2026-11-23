import { test, expect } from '@playwright/test';
import { skipFirstVisitPrompts } from '../e2e/support/helpers';

// ─────────────────────────────────────────────────────────────────────────────
// "Twój tydzień" in the STATIC EXPORT. Every move on this page — copying a
// shared plan, opening a plan, back to the list, the header's "Mój tydzień" —
// is a navigation to the same route with another query string: exactly what
// the App Router gets wrong in the export (see src/lib/inPageNavigation.ts).
// On `next dev` all of it works either way. Here it shipped broken: the copy
// was saved, and the page stayed on the shared plan.
//
// Real data, so only shapes are asserted: an 8-character ?id=, headings,
// counts of plans the test made itself.
// ─────────────────────────────────────────────────────────────────────────────

const CITY = 'wroclaw';
const PLAN_PATH = `/${CITY}/moj-tydzien/`;
const PLAN_URL = /\/moj-tydzien\/\?id=[a-z0-9]{8}$/;
const LIST_URL = new RegExp(`${PLAN_PATH}$`);

test.beforeEach(async ({ page }) => {
  await skipFirstVisitPrompts(page);
});

test('a copied plan opens as a plan of my own, next to my other plans', async ({
  page,
  browser,
}) => {
  // Someone's plan, built and shared in their browser. Their first choice
  // saves the draft and gives it its address.
  await page.goto(PLAN_PATH);
  const surprise = page.getByRole('button', { name: 'Zaskocz mnie' });
  await expect(surprise).toBeEnabled({ timeout: 30_000 });
  await surprise.click();
  await expect(page).toHaveURL(PLAN_URL);
  await page.getByRole('button', { name: 'Udostępnij plan' }).click();
  const link = await page
    .getByRole('dialog', { name: 'Udostępnij plan' })
    .getByRole('textbox', { name: 'Link do planu' })
    .inputValue();

  // The friend cold-loads that link in a browser of their own.
  const context = await browser.newContext();
  const friend = await context.newPage();
  await skipFirstVisitPrompts(friend);
  const url = new URL(link);
  await friend.goto(url.pathname + url.search);
  await friend.getByRole('button', { name: 'Skopiuj do moich planów' }).click();

  await expect(friend).toHaveURL(PLAN_URL);
  await expect(friend.getByRole('heading', { level: 1, name: 'Plan od znajomych' })).toBeVisible();
  await expect(
    friend.getByRole('list', { name: 'Twój tydzień' }).getByRole('article').first()
  ).toBeVisible();

  // To the list, and a second plan, for next week.
  await friend.getByRole('link', { name: 'Twoje plany' }).click();
  await expect(friend).toHaveURL(LIST_URL);
  await expect(friend.getByRole('heading', { level: 1, name: 'Twoje plany' })).toBeVisible();
  await friend.getByRole('button', { name: 'Nowy plan' }).click();
  await friend
    .getByRole('dialog', { name: 'Na który tydzień?' })
    .getByRole('button', { name: /Przyszły tydzień/ })
    .click();
  await expect(friend).toHaveURL(PLAN_URL);
  await expect(friend.getByRole('heading', { level: 1, name: 'Przyszły tydzień' })).toBeVisible();

  // The header link to the page already open, from a plan's ?id=.
  await friend
    .getByRole('navigation', { name: 'Główna nawigacja' })
    .getByRole('link', { name: 'Mój tydzień' })
    .click();
  await expect(friend).toHaveURL(LIST_URL);
  await expect(friend.getByRole('list', { name: 'Twoje plany' }).getByRole('link')).toHaveCount(2);

  // And straight back into the copy from its card.
  await friend
    .getByRole('list', { name: 'Twoje plany' })
    .getByRole('link', { name: /Plan od znajomych/ })
    .click();
  await expect(friend).toHaveURL(PLAN_URL);
  await expect(friend.getByRole('heading', { level: 1, name: 'Plan od znajomych' })).toBeVisible();
  await context.close();
});

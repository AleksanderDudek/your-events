import { test, expect, Page } from '@playwright/test';
import { CITY, skipFirstVisitPrompts } from './support/helpers';

// Seasonal sections come and go with the calendar (Halloween is offered from
// 10 Oct to 2 Nov), so the suite cannot rely on one being live. The `seasons`
// table and the per-season count are answered here with a season running
// today; the events themselves come from the real database.

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'Content-Range',
};

const HALLOWEEN_ROW = {
  slug: 'halloween',
  name: 'Halloween',
  emoji: '🎃',
  description: 'Bale przebierańców i warsztaty z dyniami.',
  date_from: daysFromNow(-3),
  date_to: daysFromNow(5),
  show_from: daysFromNow(-8),
  sort: 10,
};

// The pipeline's year-round section: renewed daily, from yesterday to a year on.
const STUDENCI_ROW = {
  slug: 'studenci',
  name: 'Studenci',
  emoji: '🎓',
  description: 'Wykłady otwarte, konferencje, koła naukowe, koncerty uczelni.',
  date_from: daysFromNow(-1),
  date_to: daysFromNow(365),
  show_from: daysFromNow(-1),
  sort: 50,
};

async function offerSeason(page: Page, count = 42, rows: object[] = [HALLOWEEN_ROW]): Promise<void> {
  await page.route(/\/rest\/v1\/seasons\?/, (route) => route.fulfill({ headers: CORS, json: rows }));
  // The count is a HEAD request; PostgREST answers it in Content-Range.
  await page.route(/\/rest\/v1\/events\?select=id&seasons=cs\./, (route) =>
    route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `*/${count}` }, body: '' })
  );
}

test.describe('Seasonal sections', () => {
  test.beforeEach(async ({ page }) => {
    await skipFirstVisitPrompts(page);
  });

  test('no season on offer: no tile and no season bar', async ({ page }) => {
    await page.route(/\/rest\/v1\/seasons\?/, (route) =>
      route.fulfill({ headers: CORS, json: [] })
    );
    await page.goto(`/${CITY}`);
    // The regular tiles have upgraded their hrefs, so the page has hydrated
    // and every client query has had its chance.
    await expect(
      page.getByRole('link', { name: /Co się dzieje teraz/ }).first()
    ).toHaveAttribute('href', /dateSingle=/, { timeout: 15000 });
    await expect(page.locator('a[data-season]')).toHaveCount(0);

    await page.goto(`/${CITY}/wydarzenia`);
    await expect(page.getByText(/Znaleziono \d+ wydarze/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('group', { name: 'Sezonowe' })).toHaveCount(0);
  });

  test('the home tile leads to the season, and the toggle on the list turns it off', async ({
    page,
  }) => {
    await offerSeason(page);
    await page.goto(`/${CITY}`);

    const tile = page.locator('a[data-season="halloween"]');
    await expect(tile).toBeVisible({ timeout: 15000 });
    await expect(tile).toContainText('42 wydarzenia');
    await expect(tile).toHaveAttribute('href', /season=halloween/);

    const seasonQuery = page.waitForRequest(
      (req) =>
        req.url().includes('/rest/v1/events') &&
        req.url().includes('select=*') &&
        decodeURIComponent(req.url()).includes('seasons=cs.{halloween}')
    );
    await tile.click();
    await expect(page).toHaveURL(/season=halloween/);
    await seasonQuery;

    const toggle = page.getByRole('button', { name: 'Halloween: 42 wydarzenia' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Bale przebierańców i warsztaty z dyniami.')).toBeVisible();

    await toggle.click();
    await expect(page).not.toHaveURL(/season=/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('a year-round section is a "Dla studentów" tile and a toggle on the list', async ({
    page,
  }) => {
    await offerSeason(page, 12, [STUDENCI_ROW]);
    await page.goto(`/${CITY}`);

    const tile = page.locator('a[data-section="studenci"]');
    await expect(tile).toBeVisible({ timeout: 15000 });
    await expect(tile).toContainText('Dla studentów');
    await expect(tile).toContainText('Zobacz 12 wydarzeń');
    // Not the seasonal tile at the head of the grid.
    await expect(page.locator('a[data-season]')).toHaveCount(0);
    await expect(tile).toHaveAttribute('href', /season=studenci/);

    await tile.click();
    await expect(page).toHaveURL(/season=studenci/);
    await expect(page.getByRole('group', { name: 'Sekcje tematyczne' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Studenci: 12 wydarzeń' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('a season in a link that is not on offer still shows as a removable chip', async ({
    page,
  }) => {
    await page.route(/\/rest\/v1\/seasons\?/, (route) =>
      route.fulfill({ headers: CORS, json: [] })
    );
    await page.goto(`/${CITY}/wydarzenia?season=swieta`);
    const chip = page.getByRole('button', { name: 'Swieta' });
    await expect(chip).toBeVisible({ timeout: 15000 });
    await chip.locator('.MuiChip-deleteIcon').click();
    await expect(page).not.toHaveURL(/season=/);
  });
});

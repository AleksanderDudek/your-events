import { test, expect, type Page } from '@playwright/test';
import { CITY, firstCard, gotoEvents, skipFirstVisitPrompts } from './support/helpers';

// "Poleć Idź na miasto" (the app, with the promo video) and "Udostępnij
// wydarzenie" (one event). Headless Chromium has no share sheet, so the
// specs that need one install a recording stand-in: the contract is what the
// page hands to navigator.share, not what the OS does with it.

const BANNER_TITLE = /co dziś robimy\?/;

async function recordShares(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: { title?: string; text?: string; url?: string; files?: { name: string; type: string; size: number }[] }[] = [];
    (window as unknown as { __shares: typeof calls }).__shares = calls;
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        calls.push({
          title: data.title,
          text: data.text,
          url: data.url,
          files: data.files?.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        });
      },
    });
  });
}

const shares = (page: Page) => page.evaluate(() => (window as unknown as { __shares: unknown[] }).__shares);

test.beforeEach(async ({ page }) => {
  await skipFirstVisitPrompts(page);
});

test.describe('Recommend the app', () => {
  test('the home banner opens a dialog with a caption for each format', async ({ page }) => {
    await page.goto(`/${CITY}`);
    const banner = page.getByRole('region', { name: BANNER_TITLE });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Udostępnij' }).click();

    const dialog = page.getByRole('dialog', { name: 'Poleć Idź na miasto' });
    await expect(dialog).toBeVisible();
    const caption = dialog.getByLabel('Opis');
    await expect(caption).toHaveValue(/idznamiasto\.pl/);
    await expect(caption).toHaveValue(/#idznamiasto #Wrocław/);
    expect([...(await caption.inputValue())].length).toBeLessThanOrEqual(130);

    await dialog.getByRole('button', { name: /Relacja \/ Short/ }).click();
    await expect(caption).toHaveValue(/^Coś się dzieje, a Ty nie wiesz\?/);
    await expect(dialog.getByRole('link', { name: /Pobierz film/ })).toHaveAttribute('download', 'idznamiasto-story.mp4');
  });

  test('shares the promo video with the caption through the share sheet', async ({ page }) => {
    await recordShares(page);
    await page.goto(`/${CITY}`);
    await page.getByRole('banner').getByRole('button', { name: 'Poleć znajomym' }).click();

    const dialog = page.getByRole('dialog', { name: 'Poleć Idź na miasto' });
    // The video is downloaded when the dialog opens, so the tap shares at once.
    const share = dialog.getByRole('button', { name: 'Udostępnij z filmem' });
    await expect(share).toBeEnabled({ timeout: 30_000 });
    await share.click();

    await expect.poll(async () => (await shares(page)).length).toBe(1);
    const [data] = (await shares(page)) as { text: string; files: { name: string; type: string; size: number }[] }[];
    expect(data.text).toContain('idznamiasto.pl');
    expect(data.files).toHaveLength(1);
    expect(data.files[0]).toMatchObject({ name: 'idznamiasto-post.mp4', type: 'video/mp4' });
    expect(data.files[0].size).toBeGreaterThan(100_000);
  });

  test('falls back to the image when the video cannot be fetched', async ({ page }) => {
    await recordShares(page);
    await page.route('**/promo/*.mp4', (route) => route.abort());
    await page.goto(`/${CITY}`);
    await page.getByRole('banner').getByRole('button', { name: 'Poleć znajomym' }).click();

    const dialog = page.getByRole('dialog', { name: 'Poleć Idź na miasto' });
    await dialog.getByRole('button', { name: 'Udostępnij z grafiką' }).click();
    await expect(dialog.getByRole('status')).toContainText('Filmu nie udało się przygotować');
    await expect.poll(async () => (await shares(page)).length).toBe(1);
    const [data] = (await shares(page)) as { files: { name: string }[] }[];
    expect(data.files[0].name).toBe('idznamiasto-post.jpg');
  });

  test('the banner stays hidden once dismissed', async ({ page }) => {
    await page.goto(`/${CITY}`);
    await page.getByRole('button', { name: 'Ukryj baner' }).click();
    await expect(page.getByRole('region', { name: BANNER_TITLE })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: BANNER_TITLE })).toHaveCount(0);
  });

  test('every page has a link preview image', async ({ page }) => {
    await page.goto(`/${CITY}`);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /\/promo\/og\.jpg$|^https?:\/\//);
  });
});

test.describe('Share an event', () => {
  test('hands the share sheet this event and its address', async ({ page }) => {
    await recordShares(page);
    await gotoEvents(page);
    await firstCard(page).click();
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).not.toBeEmpty();

    await page.getByRole('button', { name: 'Udostępnij wydarzenie' }).click();
    await expect.poll(async () => (await shares(page)).length).toBe(1);
    const [data] = (await shares(page)) as { title: string; url: string; text: string }[];
    const here = new URL(page.url());
    expect(data.url).toBe(`${here.origin}${here.pathname}`);
    expect(data.title.length).toBeGreaterThan(0);
    expect(data.text).toContain(data.title);
  });

  test('without a share sheet, offers copying the link and web links', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();

    await page.getByRole('button', { name: 'Udostępnij wydarzenie' }).click();
    await expect(page.getByRole('menuitem', { name: 'Kopiuj link' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
    await expect(page.getByRole('menuitem', { name: 'Facebook' })).toHaveAttribute('href', /facebook\.com\/sharer/);
  });
});

import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { CITY, skipFirstVisitPrompts } from './support/helpers';

// "Twój tydzień" → "Udostępnij plan": the link with the plan written out, the
// chat apps, the PDF; and the other end — opening a link and copying the plan.
// Runs against real data: "Zaskocz mnie" fills whatever days have events.

const PLAN_PATH = `/${CITY}/moj-tydzien/`;

async function buildPlan(page: Page): Promise<void> {
  await page.goto(PLAN_PATH);
  const surprise = page.getByRole('button', { name: 'Zaskocz mnie' });
  await expect(surprise).toBeEnabled({ timeout: 20_000 });
  await surprise.click();
  await expect(page.getByRole('list', { name: 'Twój tydzień' }).getByRole('article').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await skipFirstVisitPrompts(page);
});

test.describe('Sharing a week plan', () => {
  test('the dialog offers the link, the chats and a PDF', async ({ page }) => {
    await buildPlan(page);
    await page.getByRole('button', { name: 'Udostępnij plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Udostępnij plan' });

    const link = await dialog.getByRole('textbox', { name: 'Link do planu' }).inputValue();
    expect(link).toMatch(new RegExp(`/${CITY}/moj-tydzien/\\?plan=\\d+(\\.\\d+)*$`));

    const whatsapp = await dialog.getByRole('link', { name: 'WhatsApp' }).getAttribute('href');
    const message = decodeURIComponent(whatsapp!.split('text=')[1]);
    expect(message).toContain('• ');
    expect(message.trimEnd().endsWith(link)).toBe(true);

    // Made on demand, then saved in the same click.
    const [file] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      dialog.getByRole('button', { name: 'Pobierz PDF' }).click(),
    ]);
    await expect(dialog.getByRole('link', { name: 'Pobierz PDF' })).toBeVisible();
    expect(file.suggestedFilename()).toMatch(new RegExp(`^idznamiasto-plan-${CITY}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
    const bytes = readFileSync((await file.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(30_000); // three embedded fonts at least
  });

  test('where the share sheet takes files, the PDF is made, then sent', async ({ page }) => {
    // Headless Chromium has no share sheet: record what the page hands to it.
    await page.addInitScript(() => {
      const calls: { text?: string; files?: { name: string; type: string; size: number }[] }[] = [];
      (window as unknown as { __shares: typeof calls }).__shares = calls;
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: ShareData) => {
          calls.push({ text: data.text, files: data.files?.map((f) => ({ name: f.name, type: f.type, size: f.size })) });
        },
      });
    });
    await buildPlan(page);
    await page.getByRole('button', { name: 'Udostępnij plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Udostępnij plan' });

    await dialog.getByRole('button', { name: 'Przygotuj PDF' }).click();
    await dialog.getByRole('button', { name: 'Wyślij PDF' }).click({ timeout: 30_000 });
    const shares = await page.evaluate(
      () => (window as unknown as { __shares: { files?: { name: string; type: string; size: number }[] }[] }).__shares
    );
    expect(shares).toHaveLength(1);
    expect(shares[0].files).toEqual([
      expect.objectContaining({ type: 'application/pdf', name: expect.stringMatching(/\.pdf$/) }),
    ]);

    // "Więcej" hands the system sheet the written-out plan.
    await dialog.getByRole('button', { name: 'Więcej' }).click();
    const texts = await page.evaluate(() => (window as unknown as { __shares: { text?: string }[] }).__shares.map((c) => c.text));
    expect(texts[1]).toContain('?plan=');
  });

  test('a recipient opens the link and copies the plan to their own', async ({ page, browser }) => {
    await buildPlan(page);
    await page.getByRole('button', { name: 'Udostępnij plan' }).click();
    const link = await page
      .getByRole('dialog', { name: 'Udostępnij plan' })
      .getByRole('textbox', { name: 'Link do planu' })
      .inputValue();
    const names = await page
      .getByRole('list', { name: 'Twój tydzień' })
      .getByRole('article')
      .evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')));

    // Someone else, another browser: no plan of their own yet.
    const context = await browser.newContext();
    const friend = await context.newPage();
    await skipFirstVisitPrompts(friend);
    await friend.goto(new URL(link).pathname + new URL(link).search);
    await expect(friend.getByRole('heading', { name: 'Plan, który ktoś Ci podesłał' })).toBeVisible();
    await friend.getByRole('button', { name: 'Skopiuj do mojego planu' }).click();

    await expect(friend).toHaveURL(new RegExp(`${PLAN_PATH}$`));
    await expect(friend.getByText('Plan skopiowany. Zmieniaj śmiało.')).toBeVisible();
    const board = friend.getByRole('list', { name: 'Twój tydzień' });
    for (const name of names) await expect(board.getByRole('article', { name: name! })).toBeVisible();
    await context.close();
  });
});

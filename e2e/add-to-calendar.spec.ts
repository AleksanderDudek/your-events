import { test, expect } from '@playwright/test';
import { firstCard, gotoEvents } from './support/helpers';

// The menu entries are plain anchors, so the whole contract is observable from
// their href — no need to follow the link out to Google or Outlook, which would
// test a third party's uptime rather than this code.
test.describe('Add to calendar', () => {
  test('the detail page offers three calendar destinations', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();

    await page.getByRole('button', { name: 'Dodaj do kalendarza' }).click();

    const google = page.getByRole('menuitem', { name: /Google Calendar/ });
    await expect(google).toBeVisible();
    await expect(google).toHaveAttribute(
      'href',
      /calendar\.google\.com\/calendar\/render\?action=TEMPLATE.*dates=\d{8}/
    );

    await expect(page.getByRole('menuitem', { name: /Outlook/ })).toHaveAttribute(
      'href',
      /outlook\.live\.com\/calendar\/0\/deeplink\/compose/
    );

    const ics = page.getByRole('menuitem', { name: /Pobierz plik/ });
    await expect(ics).toHaveAttribute('href', /^data:text\/calendar;charset=utf-8,/);
    await expect(ics).toHaveAttribute('download', /\.ics$/);
  });
});

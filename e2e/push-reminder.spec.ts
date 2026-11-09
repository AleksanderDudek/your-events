import { test, expect } from '@playwright/test';
import { markFirstVisitAnswered } from './support/helpers';

// The browser's push service cannot be reached from CI, so the service worker
// and PushManager are stubbed. What this proves is everything around them: the
// card, the permission click, the RPC the server receives, the bell, and that
// both survive a reload (IndexedDB is real here).
test.describe('Push reminders on /moje-filtry', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = 'e2e.push.subscribed';
      const endpoint = 'https://fcm.googleapis.com/fcm/send/e2e';
      const sub = {
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
        unsubscribe: async () => {
          localStorage.removeItem(KEY);
          return true;
        },
      };
      const pushManager = {
        getSubscription: async () => (localStorage.getItem(KEY) ? sub : null),
        subscribe: async () => {
          localStorage.setItem(KEY, '1');
          return sub;
        },
      };
      const reg = { pushManager };
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { register: async () => reg, getRegistration: async () => reg, ready: Promise.resolve(reg) },
      });
      (window as unknown as { PushManager: unknown }).PushManager ??= function PushManager() {};
      // Headless Chromium reports 'denied' by default, which the card would
      // show as "blocked"; the stub makes it the granted state.
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'granted' });
      Notification.requestPermission = async () => 'granted';
    });
    await page.route('**/rest/v1/rpc/push_*', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto('/moje-filtry');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.localStorage.setItem(
        'go-to-city.presets',
        JSON.stringify([
          {
            id: 'e2e-1',
            name: 'Taniec e2e',
            cityId: 'wroclaw',
            createdAt: '2026-11-05T10:00:00.000Z',
            filters: {
              search: '', categories: ['taniec'], dateWindow: 'weekend', dateFrom: null, dateTo: null,
              weekdays: [], hourFrom: null, hourTo: null, freeOnly: false, near: null, season: null,
              viewMode: 'grid', pageSize: 15,
            },
          },
        ])
      );
    });
    // The onboarding's own notification step is a different surface; answered
    // here so this file is about the card and the bell only.
    await markFirstVisitAnswered(page);
    await page.reload();
  });

  test('switching on sends the subscription with a timezone, and the bell marks a filter', async ({ page }) => {
    const subscribe = page.waitForRequest('**/rest/v1/rpc/push_subscribe');
    await page.getByRole('switch', { name: 'Przypominaj mi' }).click();
    const body = (await subscribe).postDataJSON();
    expect(body.p_endpoint).toBe('https://fcm.googleapis.com/fcm/send/e2e');
    expect(typeof body.p_tz).toBe('string');
    await expect(page.getByRole('switch', { name: 'Przypominaj mi' })).toBeChecked();

    const bell = page.getByRole('button', { name: 'Przypominaj o tym filtrze' });
    await bell.click();
    await expect(bell).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByRole('switch', { name: 'Przypominaj mi' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Przypominaj o tym filtrze' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a reminder link opens the marked filter', async ({ page }) => {
    await page.goto('/moje-filtry/?open=e2e-1&src=push');
    await expect(page).toHaveURL(/\/wroclaw\/wydarzenia\/?\?.*categories=taniec/);
  });
});

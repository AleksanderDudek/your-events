import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ getSupabaseForCity: () => ({ rpc }) }));
vi.mock('@/config/env', () => ({ env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'AQID' } }));
vi.mock('@/config/cities', () => ({ DEFAULT_CITY_ID: 'szczecin' }));
vi.mock('@/lib/constants', () => ({ withBasePath: (p: string) => `/your-events${p}` }));

import {
  deviceTimeZone,
  refreshSubscription,
  subscribeDevice,
  unsubscribeDevice,
  urlBase64ToUint8Array,
} from './pushClient';

function fakeSubscription(endpoint = 'https://fcm.googleapis.com/fcm/send/abc', key: number[] | null = [1, 2, 3]) {
  return {
    endpoint,
    options: { applicationServerKey: key ? new Uint8Array(key).buffer : null },
    toJSON: () => ({ endpoint, keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function installBrowser(opts: { permission?: NotificationPermission; existing?: ReturnType<typeof fakeSubscription> | null } = {}) {
  const created = fakeSubscription();
  const pushManager = {
    getSubscription: vi.fn(async () => opts.existing ?? null),
    subscribe: vi.fn(async () => created),
  };
  const reg = { pushManager };
  const serviceWorker = {
    register: vi.fn(async () => reg),
    getRegistration: vi.fn(async () => reg),
    ready: Promise.resolve(reg),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
  vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => opts.permission ?? 'granted') });
  return { serviceWorker, pushManager, created };
}

describe('pushClient', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('decodes a base64url VAPID key', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });

  it('reads the device timezone, with Warsaw as the fallback', () => {
    expect(typeof deviceTimeZone()).toBe('string');
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl');
    });
    expect(deviceTimeZone()).toBe('Europe/Warsaw');
    spy.mockRestore();
  });

  it('returns denied without touching the service worker', async () => {
    const { serviceWorker } = installBrowser({ permission: 'denied' });
    expect(await subscribeDevice()).toBe('denied');
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('registers under the base path, subscribes and sends the subscription with the timezone', async () => {
    const { serviceWorker, pushManager } = installBrowser();
    expect(await subscribeDevice()).toBe('enabled');
    expect(serviceWorker.register).toHaveBeenCalledWith('/your-events/push-sw.js', { scope: '/your-events/' });
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(rpc).toHaveBeenCalledWith('push_subscribe', {
      p_endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p_p256dh: 'P',
      p_auth: 'A',
      p_tz: deviceTimeZone(),
    });
  });

  it('reuses an existing subscription', async () => {
    const existing = fakeSubscription('https://fcm.googleapis.com/fcm/send/old');
    const { pushManager } = installBrowser({ existing });
    expect(await subscribeDevice()).toBe('enabled');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('push_subscribe', expect.objectContaining({ p_endpoint: existing.endpoint }));
  });

  it('reports failed when the server refuses', async () => {
    installBrowser();
    rpc.mockResolvedValue({ error: { message: 'not a push service' } });
    expect(await subscribeDevice()).toBe('failed');
  });

  it('unsubscribes the browser and the server', async () => {
    const existing = fakeSubscription();
    installBrowser({ existing });
    await unsubscribeDevice();
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('push_unsubscribe', { p_endpoint: existing.endpoint });
  });

  it('replaces a subscription made with an old VAPID key', async () => {
    const old = fakeSubscription('https://fcm.googleapis.com/fcm/send/old', [9, 9, 9]);
    const { pushManager, created } = installBrowser({ existing: old });
    expect(await subscribeDevice()).toBe('enabled');
    expect(rpc).toHaveBeenCalledWith('push_unsubscribe', { p_endpoint: old.endpoint });
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('push_subscribe', expect.objectContaining({ p_endpoint: created.endpoint }));
  });

  it('keeps a subscription whose key is unknown', async () => {
    const existing = fakeSubscription('https://fcm.googleapis.com/fcm/send/k', null);
    const { pushManager } = installBrowser({ existing });
    expect(await subscribeDevice()).toBe('enabled');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });

  it('refreshSubscription re-subscribes on key rotation without prompting', async () => {
    const old = fakeSubscription('https://fcm.googleapis.com/fcm/send/old', [7]);
    const { pushManager } = installBrowser({ existing: old });
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    await refreshSubscription();
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('push_subscribe', expect.anything());
  });

  it('refreshSubscription does nothing without granted permission', async () => {
    const { pushManager } = installBrowser({ existing: fakeSubscription() });
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    await refreshSubscription();
    expect(pushManager.getSubscription).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports failed when Notification does not exist', async () => {
    installBrowser();
    vi.stubGlobal('Notification', undefined);
    expect(await subscribeDevice()).toBe('failed');
  });
});

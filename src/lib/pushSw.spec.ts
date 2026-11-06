import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writePushSettings } from './pushSettingsStore';

// public/push-sw.js is a plain script with no build step. Running its source in
// a fresh vm context with a fake `self` tests the file that actually ships.
const SOURCE = readFileSync(path.resolve(__dirname, '../../public/push-sw.js'), 'utf8');

type Listener = (event: unknown) => void;

function boot(scope = 'https://idznamiasto.pl/', idb: unknown = globalThis.indexedDB) {
  const listeners: Record<string, Listener> = {};
  const self = {
    indexedDB: idb,
    registration: { scope, showNotification: vi.fn(async () => undefined) },
    clients: {
      matchAll: vi.fn(async () => [] as unknown[]),
      openWindow: vi.fn(async () => null),
      claim: vi.fn(async () => undefined),
    },
    caches: { keys: vi.fn(async () => ['workbox-precache-v2']), delete: vi.fn(async () => true) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
  };
  vm.runInNewContext(SOURCE, { self }, { filename: 'push-sw.js' });
  return { self, listeners };
}

async function fire(listener: Listener, event: Record<string, unknown>) {
  const pending: Promise<unknown>[] = [];
  listener({ ...event, waitUntil: (p: Promise<unknown>) => pending.push(p) });
  await Promise.all(pending);
}

const PAYLOAD = {
  web_push: 8030,
  notification: {
    title: 'Idź na miasto',
    body: 'Zobacz, jakie są nowe wydarzenia w Twojej okolicy',
    navigate: 'https://idznamiasto.pl/?src=push',
  },
  mutable: true,
};
const pushEvent = (payload: unknown = PAYLOAD) => ({ data: { json: () => payload } });

describe('push-sw.js', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('with no record shows the payload as received', async () => {
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({
        body: 'Zobacz, jakie są nowe wydarzenia w Twojej okolicy',
        tag: 'reminder',
        data: { url: 'https://idznamiasto.pl/?src=push' },
      })
    );
  });

  it('with no marked filter opens the home page', async () => {
    await writePushSettings({ locale: 'pl', preset: null });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({ data: { url: 'https://idznamiasto.pl/?src=push' } })
    );
  });

  it('with a marked filter names it and opens it', async () => {
    await writePushSettings({ locale: 'pl', preset: { id: 'p 1', name: 'Taniec w weekend' } });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Taniec w weekend',
      expect.objectContaining({
        body: 'Zobacz, co nowego pasuje do tego filtra',
        data: { url: 'https://idznamiasto.pl/moje-filtry/?open=p%201&src=push' },
      })
    );
  });

  it('speaks English when the page was in English', async () => {
    await writePushSettings({ locale: 'en', preset: null });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({ body: 'See what is new near you' })
    );
  });

  it('builds links under the base path of the dev site', async () => {
    await writePushSettings({ locale: 'pl', preset: { id: 'p1', name: 'X' } });
    const { self, listeners } = boot('https://aleksanderdudek.github.io/your-events/');
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'X',
      expect.objectContaining({
        data: { url: 'https://aleksanderdudek.github.io/your-events/moje-filtry/?open=p1&src=push' },
      })
    );
  });

  it('cuts a long filter name to 60 characters', async () => {
    await writePushSettings({ locale: 'pl', preset: { id: 'p1', name: 'a'.repeat(80) } });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith('a'.repeat(60), expect.anything());
  });

  it('still shows something when the payload cannot be parsed', async () => {
    const { self, listeners } = boot();
    await fire(listeners.push, { data: { json: () => { throw new Error('bad'); } } });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({ data: { url: 'https://idznamiasto.pl/?src=push' } })
    );
  });

  it('still shows something when IndexedDB throws', async () => {
    const broken = { open: () => { throw new Error('blocked'); } };
    const { self, listeners } = boot('https://idznamiasto.pl/', broken);
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
  });

  it('a click focuses and navigates an open tab of the site', async () => {
    const { self, listeners } = boot();
    const tab = { url: 'https://idznamiasto.pl/szczecin/wydarzenia/', focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) };
    self.clients.matchAll.mockResolvedValue([tab]);
    const close = vi.fn();
    await fire(listeners.notificationclick, { notification: { close, data: { url: 'https://idznamiasto.pl/?src=push' } } });
    expect(close).toHaveBeenCalled();
    expect(tab.focus).toHaveBeenCalled();
    expect(tab.navigate).toHaveBeenCalledWith('https://idznamiasto.pl/?src=push');
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('a click opens a window when no tab is open, or navigate fails', async () => {
    const { self, listeners } = boot();
    const tab = { url: 'https://idznamiasto.pl/', focus: vi.fn(async () => undefined), navigate: vi.fn(async () => { throw new TypeError('uncontrolled'); }) };
    self.clients.matchAll.mockResolvedValue([tab]);
    await fire(listeners.notificationclick, { notification: { close: vi.fn(), data: { url: 'https://idznamiasto.pl/?src=push' } } });
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://idznamiasto.pl/?src=push');
  });

  it('activate clears the old PWA caches and takes control of open tabs', async () => {
    const { self, listeners } = boot();
    await fire(listeners.activate, {});
    expect(self.caches.delete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(self.clients.claim).toHaveBeenCalled();
  });
});

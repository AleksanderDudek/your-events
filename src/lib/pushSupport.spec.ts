import { describe, expect, it } from 'vitest';
import { pushSupport } from './pushSupport';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

interface Opts {
  ua?: string;
  platform?: string;
  touch?: number;
  standalone?: boolean;
  displayStandalone?: boolean;
  api?: boolean;
  permission?: NotificationPermission;
}

function env(o: Opts = {}) {
  const nav: Record<string, unknown> = {
    userAgent: o.ua ?? ANDROID,
    platform: o.platform ?? 'Linux armv8l',
    maxTouchPoints: o.touch ?? 5,
  };
  if (o.standalone !== undefined) nav.standalone = o.standalone;
  if (o.api !== false) nav.serviceWorker = {};
  const win: Record<string, unknown> = {
    matchMedia: (q: string) => ({ matches: q === '(display-mode: standalone)' && Boolean(o.displayStandalone) }),
  };
  if (o.api !== false) {
    win.PushManager = function PushManager() {};
    win.Notification = { permission: o.permission ?? 'default' };
  }
  return [nav as unknown as Navigator, win as unknown as Window] as const;
}

describe('pushSupport', () => {
  it('ready on Android Chrome', () => {
    expect(pushSupport(...env())).toBe('ready');
  });

  it('blocked when permission was denied', () => {
    expect(pushSupport(...env({ permission: 'denied' }))).toBe('blocked');
  });

  it('unsupported without the APIs', () => {
    expect(pushSupport(...env({ api: false }))).toBe('unsupported');
  });

  it('iPhone in Safari has to install first', () => {
    expect(pushSupport(...env({ ua: IPHONE, platform: 'iPhone', api: false }))).toBe('ios-install-first');
  });

  it('iPhone from the Home Screen is ready (navigator.standalone)', () => {
    expect(pushSupport(...env({ ua: IPHONE, platform: 'iPhone', standalone: true }))).toBe('ready');
  });

  it('iPhone from the Home Screen is ready (display-mode media query)', () => {
    expect(pushSupport(...env({ ua: IPHONE, platform: 'iPhone', displayStandalone: true }))).toBe('ready');
  });

  it('iPad that reports itself as a Mac still has to install first', () => {
    expect(pushSupport(...env({ ua: MAC, platform: 'MacIntel', touch: 5, api: false }))).toBe('ios-install-first');
  });

  it('a real Mac with Safari is ready', () => {
    expect(pushSupport(...env({ ua: MAC, platform: 'MacIntel', touch: 0 }))).toBe('ready');
  });
});

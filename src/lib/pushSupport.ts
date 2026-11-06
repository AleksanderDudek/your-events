// Which of four states the visitor's browser is in for push reminders. Pure:
// navigator and window are passed in, so every branch has a unit test.
export type PushSupport = 'ready' | 'ios-install-first' | 'blocked' | 'unsupported';

function isIos(nav: Navigator): boolean {
  // iPadOS Safari reports itself as a Mac; a touch screen gives it away.
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

function isStandalone(nav: Navigator, win: Window): boolean {
  return (
    (nav as Navigator & { standalone?: boolean }).standalone === true ||
    win.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export function pushSupport(nav: Navigator, win: Window): PushSupport {
  // iOS delivers web push only to Home Screen web apps. Checked before the
  // APIs, because Safari in a tab does not expose PushManager at all.
  if (isIos(nav) && !isStandalone(nav, win)) return 'ios-install-first';
  const w = win as Window & { PushManager?: unknown; Notification?: { permission: NotificationPermission } };
  if (!('serviceWorker' in nav) || !w.PushManager || !w.Notification) return 'unsupported';
  if (w.Notification.permission === 'denied') return 'blocked';
  return 'ready';
}

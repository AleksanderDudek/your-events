// Browser plumbing for push reminders: register the worker, ask permission,
// subscribe, and tell the server. UI code goes through usePushReminder.
import { getSupabaseForCity } from '@/lib/supabase';
import { DEFAULT_CITY_ID } from '@/config/cities';
import { env } from '@/config/env';
import { withBasePath } from '@/lib/constants';

export const PUSH_SW_PATH = '/push-sw.js';

export type EnableResult = 'enabled' | 'denied' | 'failed';

// Subscriptions live in the hub project. The default city reads the shared
// NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY, which is the hub, and its schema
// (dev / public) follows NEXT_PUBLIC_SUPABASE_SCHEMA like every other query.
function hub() {
  return getSupabaseForCity(DEFAULT_CITY_ID);
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  } catch {
    return 'Europe/Warsaw';
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(withBasePath('/'));
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Sends (or refreshes) this browser's subscription, with its current timezone. */
export async function sendSubscription(sub: PushSubscription): Promise<void> {
  const keys = sub.toJSON().keys ?? {};
  const { error } = await hub().rpc('push_subscribe', {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh ?? '',
    p_auth: keys.auth ?? '',
    p_tz: deviceTimeZone(),
  });
  if (error) throw new Error(error.message);
}

function sameBytes(a: ArrayBuffer, b: Uint8Array): boolean {
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/**
 * The browser's subscription for the current VAPID key. A subscription made
 * with an older key is dropped and made again: the push service answers 403
 * for it for ever otherwise. An unknown key (null) is kept.
 */
async function ensureSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const key = urlBase64ToUint8Array(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const current = existing.options?.applicationServerKey ?? null;
    if (!current || sameBytes(current, key)) return existing;
    await hub().rpc('push_unsubscribe', { p_endpoint: existing.endpoint }).then(undefined, () => undefined);
    await existing.unsubscribe();
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** Must be called from a click: browsers refuse a permission prompt otherwise. */
export async function subscribeDevice(): Promise<EnableResult> {
  if (typeof Notification === 'undefined') return 'failed';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    await navigator.serviceWorker.register(withBasePath(PUSH_SW_PATH), { scope: withBasePath('/') });
    // subscribe() needs an ACTIVE worker; `ready` resolves once there is one.
    const reg = await navigator.serviceWorker.ready;
    await sendSubscription(await ensureSubscription(reg));
    return 'enabled';
  } catch {
    return 'failed';
  }
}

/** Once per session: re-sends the subscription (fresh timezone), replacing it if the VAPID key rotated. No prompt. */
export async function refreshSubscription(): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(withBasePath('/'));
  if (!reg || !(await reg.pushManager.getSubscription())) return;
  await sendSubscription(await ensureSubscription(reg));
}

export async function unsubscribeDevice(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  // If this call fails, the server row goes on its own: the push service
  // answers 410 for an unsubscribed endpoint and push_record deletes the row.
  await hub().rpc('push_unsubscribe', { p_endpoint: endpoint });
}

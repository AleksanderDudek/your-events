// deno-lint-ignore-file no-import-prefix
// The only file that knows which web-push library is in use. If Task 5's spike
// shows npm:web-push failing under Deno, replace THIS file (Task 5, step 6).
import webpush from 'npm:web-push@3.6.7';
import type { Subscription } from './handler.ts';

export interface Vapid {
  subject: string; // mailto: or https: contact, required by the push services
  publicKey: string;
  privateKey: string;
}

// 6 hours: a phone that is off at noon still gets it the same afternoon.
export const TTL_SECONDS = 21600;

export function makeWebPushSender(vapid: Vapid): (sub: Subscription, payload: string) => Promise<number> {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return async (sub, payload) => {
    try {
      const res = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: TTL_SECONDS, urgency: 'high' }
      );
      return res.statusCode;
    } catch (err) {
      const code = (err as { statusCode?: unknown }).statusCode;
      return typeof code === 'number' ? code : 0;
    }
  };
}

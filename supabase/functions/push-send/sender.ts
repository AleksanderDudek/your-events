// deno-lint-ignore-file no-import-prefix
// The only file that knows which web-push library is in use. If Task 5's spike
// shows npm:web-push failing under Deno, replace THIS file (Task 5, step 6).
import webpush from 'npm:web-push@3.6.7';
import type { Subscription } from './handler.ts';
import { isPushServiceUrl } from './hosts.ts';

export interface Vapid {
  subject: string; // mailto: or https: contact, required by the push services
  publicKey: string;
  privateKey: string;
}

// 6 hours: a phone that is off at noon still gets it the same afternoon.
export const TTL_SECONDS = 21600;

// Without a socket timeout a hung connection stalls the whole batch.
export const SEND_TIMEOUT_MS = 15_000;

export function makeWebPushSender(vapid: Vapid): (sub: Subscription, payload: string) => Promise<number> {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return async (sub, payload) => {
    // 410 makes push_record delete the row; nothing is sent to a foreign host.
    if (!isPushServiceUrl(sub.endpoint)) return 410;
    try {
      const res = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: TTL_SECONDS, urgency: 'high', timeout: SEND_TIMEOUT_MS }
      );
      return res.statusCode;
    } catch (err) {
      const code = (err as { statusCode?: unknown }).statusCode;
      return typeof code === 'number' ? code : 0;
    }
  };
}

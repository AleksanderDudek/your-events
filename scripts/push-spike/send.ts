// Manual tool: sends one real push through the Edge Function's own sender.
// Usage:
//   deno run --node-modules-dir=none --no-lock --allow-net --allow-read --allow-env \
//     --env-file=$HOME/.config/idznamiasto/vapid.env \
//     scripts/push-spike/send.ts /private/tmp/push-sub.json
import { makeWebPushSender } from '../../supabase/functions/push-send/sender.ts';
import { buildPayload } from '../../supabase/functions/push-send/handler.ts';

const sub = JSON.parse(await Deno.readTextFile(Deno.args[0]));
const send = makeWebPushSender({
  subject: Deno.env.get('VAPID_SUBJECT')!,
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
});
const status = await send(
  { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  buildPayload('http://localhost:8787')
);
console.log('push service answered', status);

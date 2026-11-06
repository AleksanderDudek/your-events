// deno-lint-ignore-file no-import-prefix
import { assertEquals } from 'jsr:@std/assert@1';
import { isPushServiceUrl } from './hosts.ts';

Deno.test('accepts the four push services', () => {
  for (const u of [
    'https://fcm.googleapis.com/fcm/send/x',
    'https://FCM.googleapis.com/fcm/send/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://web.push.apple.com/x',
    'https://db5p.notify.windows.com/w/?token=x',
  ]) assertEquals(isPushServiceUrl(u), true, u);
});

Deno.test('rejects everything else', () => {
  for (const u of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://evil.example.com/x',
    'https://fcm.googleapis.com.evil.com/x',
    'https://fcm.googleapis.com@evil.com/x',
    'https://user@fcm.googleapis.com/x',
    'https://evil.com\\x.notify.windows.com/',
    'https://fcm.googleapis.com/fcm/send/a b',
    'not a url',
    '',
  ]) assertEquals(isPushServiceUrl(u), false, u);
});

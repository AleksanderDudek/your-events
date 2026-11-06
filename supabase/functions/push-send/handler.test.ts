// deno-lint-ignore-file no-import-prefix
import { assertEquals, assert } from 'jsr:@std/assert@1';
import { BATCH, buildPayload, handle, safeEqual, type Deps, type Schema, type Subscription } from './handler.ts';

function sub(n: number): Subscription {
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, p256dh: 'k', auth: 'a' };
}

function deps(over: Partial<Deps> = {}): Deps & { recorded: Array<[Schema, string, number]>; logs: string[] } {
  const recorded: Array<[Schema, string, number]> = [];
  const logs: string[] = [];
  let calls = 0;
  return {
    secret: 's3cret',
    siteUrls: { public: 'https://idznamiasto.pl', dev: 'https://aleksanderdudek.github.io/your-events' },
    claim: () => Promise.resolve(calls++ === 0 ? [sub(1), sub(2), sub(3)] : []),
    record: (schema, endpoint, status) => {
      recorded.push([schema, endpoint, status]);
      return Promise.resolve();
    },
    send: () => Promise.resolve(201),
    log: (line) => logs.push(line),
    recorded,
    logs,
    ...over,
  };
}

function post(body: unknown, secret = 's3cret'): Request {
  return new Request('http://x/push-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-push-secret': secret },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

Deno.test('refuses anything but POST', async () => {
  const res = await handle(new Request('http://x/push-send'), deps());
  assertEquals(res.status, 405);
});

Deno.test('refuses a missing or wrong secret, and an unset one', async () => {
  assertEquals((await handle(post({ schema: 'dev' }, ''), deps())).status, 401);
  assertEquals((await handle(post({ schema: 'dev' }, 'nope'), deps())).status, 401);
  assertEquals((await handle(post({ schema: 'dev' }, ''), deps({ secret: '' }))).status, 401);
});

Deno.test('refuses a bad body and an unknown schema', async () => {
  assertEquals((await handle(post('{not json'), deps())).status, 400);
  assertEquals((await handle(post({ schema: 'staging' }), deps())).status, 400);
});

Deno.test('refuses a schema whose site URL is not configured', async () => {
  const d = deps({ siteUrls: { public: 'https://idznamiasto.pl', dev: '' } });
  assertEquals((await handle(post({ schema: 'dev' }), d)).status, 500);
});

Deno.test('claims, sends and records every due device, and counts results', async () => {
  const statuses = [201, 410, 503];
  let i = 0;
  const d = deps({ send: () => Promise.resolve(statuses[i++]) });
  const res = await handle(post({ schema: 'dev' }), d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { claimed: 3, sent: 1, gone: 1, failed: 1, recordFailed: 0 });
  assertEquals(d.recorded.map((r) => r[2]).sort(), [201, 410, 503]);
  assert(d.recorded.every((r) => r[0] === 'dev'));
});

Deno.test('a sender that throws is recorded as status 0', async () => {
  const d = deps({ send: () => Promise.reject(new Error('reset')) });
  await handle(post({ schema: 'public' }), d);
  assert(d.recorded.every((r) => r[2] === 0));
});

Deno.test('keeps claiming while a batch comes back full', async () => {
  let call = 0;
  const d = deps({
    claim: () => {
      call++;
      if (call === 1) return Promise.resolve(Array.from({ length: BATCH }, (_, n) => sub(n)));
      if (call === 2) return Promise.resolve([sub(9999)]);
      return Promise.resolve([]);
    },
  });
  const res = await handle(post({ schema: 'dev' }), d);
  assertEquals((await res.json()).claimed, BATCH + 1);
  assertEquals(call, 2);
});

Deno.test('a failed record is counted, not fatal', async () => {
  const d = deps({ record: () => Promise.reject(new Error('db')) });
  const res = await handle(post({ schema: 'dev' }), d);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).recordFailed, 3);
});

Deno.test('the log line carries counts, never an endpoint', async () => {
  const d = deps();
  await handle(post({ schema: 'dev' }), d);
  assertEquals(d.logs.length, 1);
  assert(!d.logs[0].includes('fcm.googleapis.com'));
});

Deno.test('payload is the declarative shape, pointing at the schema site', () => {
  const p = JSON.parse(buildPayload('https://aleksanderdudek.github.io/your-events/'));
  assertEquals(p.web_push, 8030);
  assertEquals(p.mutable, true);
  assertEquals(p.notification.navigate, 'https://aleksanderdudek.github.io/your-events/?src=push');
  assertEquals(p.notification.title, 'Idź na miasto');
});

Deno.test('safeEqual', () => {
  assert(safeEqual('abc', 'abc'));
  assert(!safeEqual('abc', 'abd'));
  assert(!safeEqual('abc', 'abcd'));
  assert(!safeEqual('', 'a'));
});

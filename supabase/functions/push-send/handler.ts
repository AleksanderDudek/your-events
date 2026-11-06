// Pure request handling for push-send: everything except the network and the
// database, which come in through Deps so the loop can be tested.
// Spec: docs/superpowers/specs/2026-11-05-scheduled-push-reminder-design.md

export const SCHEMAS = ['public', 'dev'] as const;
export type Schema = (typeof SCHEMAS)[number];

export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface Deps {
  secret: string;
  siteUrls: Record<Schema, string>;
  claim(schema: Schema, batch: number): Promise<Subscription[]>;
  record(schema: Schema, endpoint: string, status: number): Promise<void>;
  /** Resolves to the push service's HTTP status, or 0 when there was none. */
  send(sub: Subscription, payload: string): Promise<number>;
  log?(line: string): void;
}

export const BATCH = 500;
export const CONCURRENCY = 20;

/** The one payload every device gets. The phone's service worker rewrites it. */
export function buildPayload(siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return JSON.stringify({
    web_push: 8030,
    notification: {
      title: 'Idź na miasto',
      body: 'Zobacz, jakie są nowe wydarzenia w Twojej okolicy',
      navigate: `${base}/?src=push`,
      lang: 'pl',
    },
    mutable: true,
  });
}

/** Constant-time string comparison, so the secret cannot be guessed by timing. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

async function forEachLimited<T>(items: T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await run(item);
    }
  });
  await Promise.all(workers);
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  if (!deps.secret || !safeEqual(req.headers.get('x-push-secret') ?? '', deps.secret)) {
    return reply(401, { error: 'unauthorized' });
  }

  let schema: unknown;
  try {
    schema = (await req.json())?.schema;
  } catch {
    return reply(400, { error: 'body' });
  }
  if (!SCHEMAS.includes(schema as Schema)) return reply(400, { error: 'schema' });
  const s = schema as Schema;
  if (!deps.siteUrls[s]) return reply(500, { error: 'site url not configured' });

  const payload = buildPayload(deps.siteUrls[s]);
  const counts = { claimed: 0, sent: 0, gone: 0, failed: 0, recordFailed: 0 };

  for (;;) {
    const batch = await deps.claim(s, BATCH);
    counts.claimed += batch.length;
    await forEachLimited(batch, CONCURRENCY, async (sub) => {
      const status = await deps.send(sub, payload).catch(() => 0);
      if (status >= 200 && status < 300) counts.sent++;
      else if (status === 404 || status === 410) counts.gone++;
      else counts.failed++;
      try {
        await deps.record(s, sub.endpoint, status);
      } catch {
        counts.recordFailed++;
      }
    });
    if (batch.length < BATCH) break;
  }

  (deps.log ?? console.log)(JSON.stringify({ schema: s, ...counts }));
  return reply(200, counts);
}

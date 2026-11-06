// push-send: called by pg_cron (via pg_net) when a device is due.
// Deployed with JWT verification OFF. The x-push-secret header is the auth.
// Secrets: PUSH_CRON_SECRET, VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// SITE_URL_PUBLIC, SITE_URL_DEV. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by the platform.
// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handle, type Schema, type Subscription } from './handler.ts';
import { makeWebPushSender } from './sender.ts';

function need(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`push-send: missing secret ${name}`);
  return value;
}

const supabaseUrl = need('SUPABASE_URL');
const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');
const send = makeWebPushSender({
  subject: need('VAPID_SUBJECT'),
  publicKey: need('VAPID_PUBLIC_KEY'),
  privateKey: need('VAPID_PRIVATE_KEY'),
});

const clients = new Map<Schema, SupabaseClient<any, string>>();
function db(schema: Schema): SupabaseClient<any, string> {
  let client = clients.get(schema);
  if (!client) {
    client = createClient<any, string>(supabaseUrl, serviceKey, {
      db: { schema },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clients.set(schema, client);
  }
  return client;
}

Deno.serve((req) =>
  handle(req, {
    secret: Deno.env.get('PUSH_CRON_SECRET') ?? '',
    siteUrls: { public: Deno.env.get('SITE_URL_PUBLIC') ?? '', dev: Deno.env.get('SITE_URL_DEV') ?? '' },
    async claim(schema, batch) {
      const { data, error } = await db(schema).rpc('push_claim_due', { p_batch: batch });
      if (error) throw new Error(`push_claim_due: ${error.message}`);
      return (data ?? []) as Subscription[];
    },
    async record(schema, endpoint, status) {
      const { error } = await db(schema).rpc('push_record', { p_endpoint: endpoint, p_status: status });
      if (error) throw new Error(`push_record: ${error.message}`);
    },
    send,
  })
);

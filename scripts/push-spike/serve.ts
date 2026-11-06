// Manual tool: serves the spike page on http://localhost:8787 (a secure
// context, so push works without HTTPS), hands it the VAPID PUBLIC key, and
// stores the browser's subscription in the file given as the first argument.
//
// Usage:
//   deno run --allow-net --allow-read --allow-write --allow-env \
//     --env-file=$HOME/.config/idznamiasto/vapid.env \
//     scripts/push-spike/serve.ts /private/tmp/push-sub.json
const out = Deno.args[0];
if (!out) throw new Error('usage: serve.ts <subscription.json>');
const dir = new URL('.', import.meta.url);
const types: Record<string, string> = { html: 'text/html; charset=utf-8', js: 'text/javascript' };

Deno.serve({ port: 8787, hostname: '127.0.0.1' }, async (req) => {
  const path = new URL(req.url).pathname;
  if (path === '/key') return new Response(Deno.env.get('VAPID_PUBLIC_KEY') ?? '', { status: 200 });
  if (path === '/sub' && req.method === 'POST') {
    await Deno.writeTextFile(out, await req.text(), { mode: 0o600 });
    console.log('subscription saved to', out);
    return new Response('ok');
  }
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (name !== 'index.html' && name !== 'sw.js') return new Response('not found', { status: 404 });
  return new Response(await Deno.readFile(new URL(name, dir)), {
    headers: { 'Content-Type': types[name.split('.').pop() ?? ''] ?? 'text/plain' },
  });
});

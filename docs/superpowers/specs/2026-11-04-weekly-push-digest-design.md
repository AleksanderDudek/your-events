# Weekly push digest, worked out on the phone — design

Date: 2026-11-04
Status: designed, not built. Waiting for the owner's review.

## The request

> chciałbym, żeby ludzie mieli jakieś push notyfikacje na telefon natywnie.
> zastanawiam się nad jakimś service-workerem albo wykorzystaniem PWA.
> z tym, że jest to architektura next.js bazująca na statycznych stronach

Constraints added while the design was being written:

> dla mnie ma to sens tylko wtedy, jeśli nie płacę za to, a całość bazuje na
> zapisach tego, co chce użytkownik. całość ma się odbywać z poziomu danych na
> telefonie.

Chosen trigger (asked and answered): **a weekly weekend digest for the city,
personalised by the visitor's saved filters when there are any.**

## Decisions

### 1. The phone works out the digest. The server only rings the bell.

This is the decision everything else follows from. Push has two halves:

- **Delivery.** Somebody has to POST to the browser's push service (Google
  FCM, Mozilla autopush, Apple's web.push.apple.com). Only the subscription
  holder can do that, and a static site cannot. **There is no way around a
  sender** on iOS: a Home Screen web app gets no background execution except
  a push event.
- **Content.** What the notification says, and which filters it is about.

The design splits them. The sender knows a list of push endpoints and
nothing else: no filters, no city, no language, no user id. Once a week it
sends every endpoint the same content-free "wake up" message. The service
worker on the phone receives it, reads the visitor's saved filters from the
phone, asks the public events API how many events match this weekend, and
writes the notification itself.

What each side knows:

| | Server (Supabase + GitHub Actions) | Phone |
|---|---|---|
| Push endpoint + its keys | yes (technically required) | yes |
| Saved filters | **no** | yes (already in localStorage) |
| City, language | **no** | yes |
| Which events matched | **no** | yes |

The endpoint is an opaque URL issued by the browser vendor. It identifies a
browser install, not a person, and it carries nothing about what the visitor
asked for.

### 2. It costs nothing

| Piece | Cost |
|---|---|
| Push services (FCM, Mozilla, Apple) | free, no account needed, VAPID keys only |
| Subscriptions table | in the existing Supabase hub project (`IdzNaMiasto`), one tiny row per device |
| Weekly send | a GitHub Actions cron job: the repository is public, so Actions minutes are free |
| Event counts | the phone calls the same public PostgREST API the site already uses, with the same anon key |

No new service, no paid tier, no third-party SDK. To check before shipping:
which Supabase plan the hub project is on. A free-tier project pauses after a
week without requests, but the scrape pipeline keeps this one active anyway.

**Why GitHub Actions and not a Supabase Edge Function.** Both are free. Actions
runs Node, where the `web-push` library is the reference implementation. In a
Deno Edge Function it is untested (it depends on Node `crypto`/`https`). This
repository already holds every secret and the `prod` environment, and
`deploy-prod.yml` already runs on a cron. A scheduled Actions run can start up
to an hour late at peak times. That is irrelevant for a weekly digest.

### 3. One notification a week, Thursday ~17:00 Europe/Warsaw

- One push per device per week, whatever the number of filters. Several
  pushes a week from one site is how notifications get turned off.
- Thursday evening is when people plan a weekend. The cron fires at
  `0 15 * * 4` and `0 16 * * 4` (UTC). The script sends only in the run where
  Warsaw local time is 17:xx, which covers DST without editing the cron.
- The window is always **the coming weekend** (Friday to Sunday,
  `resolveRelativeWindow('weekend', now)`), whatever window the filter was
  saved with:
  - `none`, `today`, `weekend`, `next7`: replaced by the weekend. A filter saved
    as "Dziś" on a Tuesday means nothing on Thursday evening.
  - `fixed`: intersected with the weekend. An empty intersection (a festival
    that is over) drops that filter from this week's digest.
  - Weekdays, hours, categories, free-only, near and season are honoured as
    saved, through the same code the list uses (decision 6).

### 4. What the notification says

The phone composes it from what it found. Polish shown, English mirrors it in
`messages.ts`.

| Situation | Title | Body | Opens |
|---|---|---|---|
| One filter, N > 0 | `W ten weekend: Taniec w weekend` | `5 wydarzeń · m.in. Salsa Night, Bachata Sunday` | that filter (`presetHref` + `src=push`) |
| Several filters | `Twój weekend w Szczecinie` (city dropped when the filters span cities) | `Taniec: 5 · Koncerty: 8 · Dla dzieci: 3` | `/moje-filtry/?src=push` |
| No filter, or every filter at 0 | `Co w ten weekend w Szczecinie?` | `42 wydarzenia od piątku do niedzieli` | city list with the weekend window |
| The fetch failed or timed out | `Weekend w Szczecinie` | `Sprawdź, co się dzieje` | city list with the weekend window |

- **A push must always produce a notification.** Chrome shows its own "site
  updated in the background" if none appears. Safari revokes the subscription
  after a few silent pushes. So every path, including errors, ends in
  `showNotification`.
- The highlights in the single-filter body are the first two names in list
  order. Names are cut to fit, and the body is capped at ~110 characters
  (lock-screen width).
- `src=push` on the link is how a return visit is measured (decision 9).

### 5. Delivery payload: declarative, mutable

The wake-up message is a **Declarative Web Push** payload with a generic
notification and `"mutable": true`:

```json
{
  "web_push": 8030,
  "notification": {
    "title": "Weekend w mieście",
    "body": "Sprawdź, co się dzieje w ten weekend",
    "navigate": "https://idznamiasto.pl/?src=push"
  },
  "mutable": true
}
```

- In Chrome and Firefox, which have no declarative support, the service worker
  receives it as an ordinary push and builds the notification itself.
- In Safari 18.4+, `mutable: true` hands the push to the service worker to
  rewrite. If the worker fails or runs out of time, Safari shows the generic
  notification above instead of nothing. That is the safety net decision 4
  needs on the platform with the shortest background budget.
- The payload is the same for every device and carries no personal data.
- The `navigate` origin comes from the sending environment (prod or dev), never
  from the client.

**To verify in phase 0:** that iOS really runs the mutable path and allows
1–3 `fetch`es before showing. If it does not, iOS gets the generic
notification and the personalisation runs on Android and desktop only.

### 6. Matching runs the list's own code, in the service worker

A digest that counts differently from the list it links to will be caught
lying the first time somebody taps it. So the worker does not re-implement the
filters:

- **Extract the pure core of `eventsApi.ts`** into `src/lib/eventQuery.ts`:
  `buildFilteredQuery`, `applyOrder`, `matchesClientFilters`,
  `parsePriceAmount`, with the Supabase client passed in rather than obtained
  from `getSupabaseForCity` (which reads `env.ts`, and `env.ts` reads
  `process.env`, which a worker does not have). `eventsApi.ts` keeps its
  public API and calls the extracted functions. Its existing tests pin the
  behaviour.
- **The worker is built, not hand-written.** `src/sw/push-sw.ts` is bundled by
  esbuild into `public/push-sw.js` before `next build`
  (`"build": "node scripts/build-sw.mjs && next build"`), so it imports
  `eventQuery`, `presets` (`presetToEventFilters`) and `dateWindows` directly.
  `public/push-sw.js` is gitignored. supabase-js works in workers (it is
  `fetch`-based).
- **Counting is cheap.** A filter with no client-side part
  (`hasClientFilters` false) is one `count: 'exact', head: true` request plus
  a `limit(2)` for the highlights. A filter with `near`/`freeOnly` runs the
  same id scan the list runs (~95 bytes a row).
- **A time budget.** All filters are counted in parallel under one 4-second
  `AbortController`. On timeout the worker shows the fallback.

One timezone trap to keep in mind: `resolveRelativeWindow` uses local
date functions. On the phone that is the visitor's own timezone, which is
right. Nothing on the server resolves dates any more.

### 7. Where the phone keeps what the worker needs

A service worker cannot read `localStorage`. The page therefore mirrors
**only what the digest needs** into IndexedDB (`idznamiasto-push` /
`settings`), on every change:

```ts
interface PushSettings {
  enabled: boolean;
  cityId: string;            // the city digest when no filter is opted in
  locale: 'pl' | 'en';
  presetIds: string[];       // filters opted in to the digest, max 3
  presets: FilterPreset[];   // copies of those filters, as saved
  // Public config of every city the digest touches. Filters are per city
  // (FilterPreset.cityId) and each city may have its own Supabase project.
  supabase: { schema: string; cities: Record<string, { url: string; anonKey: string }> };
  siteBase: string;          // origin + basePath, for links
}
```

- Written by a small `usePushSettings` hook. `usePresets.save`/`remove` call
  it, so an edited filter is the edited filter in the next digest, and a
  deleted one leaves the digest.
- The public Supabase config is written from the page, so the worker needs no
  build-time env and dev automatically reads the `dev` schema.
- **At most 3 filters** in the digest. That keeps the notification readable
  and the fetches inside the time budget.

### 8. Subscribing, and the server side

**Table** (hub project, in both the `public` and `dev` schemas, like `events`):

```sql
create table push_subscriptions (
  endpoint      text primary key,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now(),
  last_ok_at    timestamptz,
  failure_count int not null default 0
);
alter table push_subscriptions enable row level security;
-- no policies: anon can neither read nor write the table directly
```

**Two RPCs** (`security definer`, `execute` granted to `anon`), called with
the anon key through `supabase.rpc`, so no Edge Function is involved:

- `push_subscribe(endpoint, p256dh, auth)`: upsert. It refuses:
  - an endpoint that is not `https://`,
  - an endpoint on a host outside the push services' own (`fcm.googleapis.com`,
    `*.push.services.mozilla.com`, `web.push.apple.com`,
    `*.notify.windows.com`),
  - oversized keys.

  The host list is what keeps the table from becoming a free list of URLs we
  POST to every week.
- `push_unsubscribe(endpoint)`: delete. Knowing the endpoint is the
  capability: only the browser holding it knows it.

**The sender**, `.github/workflows/push-digest.yml` plus
`scripts/send-push-digest.mjs`:

- Runs on `schedule` (decision 3) in the `prod` environment against `public`.
  `workflow_dispatch` takes a `schema` input, so dev is tested by hand, never
  on a schedule.
- Reads endpoints with `SUPABASE_SERVICE_ROLE_KEY` (a new secret in each
  environment) and sends with `web-push`, concurrency 20, `TTL: 86400` (24 h:
  a phone that was off on Thursday evening still gets it on Friday, and a stale
  "this weekend" never arrives on Monday).
- Answers per endpoint:
  - `201`: set `last_ok_at`, reset `failure_count`.
  - `404`/`410`: delete the row. The browser dropped the subscription.
  - `429`/`5xx`: `failure_count + 1`. A row at 5 consecutive failures, or with
    no success for 60 days, is deleted.
- Logs counts only (sent / gone / failed), never endpoints.
- VAPID keys: the private key is an Actions secret; the public one is
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, added to `env.ts`.

### 9. Where the visitor turns it on

Permission is asked **only after a click that asks for it**. A prompt on page
load gets "Block", and a block cannot be undone from the page.

- **`/moje-filtry`, at the top:** a card "Powiadomienia o weekendzie" with one
  switch. Turning it on subscribes and opts in the city digest.
- **Each filter card:** a bell toggle "W cotygodniowym powiadomieniu". It is
  disabled with a tooltip at 3, and turning on the first one also turns on
  the top switch.
- **After saving a filter:** a snackbar offers "Powiadamiaj mnie w czwartki o
  pasujących wydarzeniach". This is the single most natural moment, because
  the visitor has just told us what they want.

Nothing anywhere else on the site. The feature is reachable from the menu
entry that already leads to `/moje-filtry`.

**Platform branches** (pure `pushSupport(navigator, window)` returning one of
these):

| Result | When | What the switch does |
|---|---|---|
| `ready` | `PushManager` + `serviceWorker` + `Notification` present | registers the worker, asks permission, subscribes |
| `ios-install-first` | iOS/iPadOS Safari, not standalone (`navigator.standalone !== true` and not `display-mode: standalone`) | opens a sheet: Share, then "Do ekranu początkowego", then open from the icon. iOS 26 opens every Home Screen site as a web app. The existing `manifest.ts` already makes ours a proper one |
| `blocked` | `Notification.permission === 'denied'` | explains how to unblock in browser settings |
| `unsupported` | anything else | the card is hidden |

**Registration:** `navigator.serviceWorker.register(withBasePath('/push-sw.js'),
{ scope: withBasePath('/') })`. On `activate` the new worker deletes caches
left by the retired Vite PWA worker (the job `public/sw.js` does today) but
does **not** unregister. It intercepts no `fetch`: this is a push worker, not
an offline cache. `public/sw.js` stays as it is until old visits age out.

**Turning it off:** the top switch calls `subscription.unsubscribe()` and
`push_unsubscribe`, then clears the IndexedDB record.

### 10. Privacy page and consent

- `/prywatnosc` gains a section covering three points:
  - what is stored on our side (a technical push address and two keys, no
    preferences),
  - what stays on the phone (filters, city, language),
  - how to delete it (switch off, or remove the site's data).
- The browser's own permission prompt is the consent. Push is not a cookie and
  does not depend on the cookie banner's choice. Clarity events still follow
  that choice, as they already do.

### 11. Measuring whether it works

Clarity custom events through `trackEvent` (snake_case, no free text):

- `push_enable`, `push_disable`, `push_ios_install_shown`, `push_denied`,
  `push_filter_on`, `push_filter_off`
- `push_open`: fired by the page on load when `src=push` is in the URL, then
  stripped from the URL with `history.replaceState`, so a shared link does not
  count again.

The workflow log's weekly sent/gone counts are the size of the audience.
`push_open` / sent is the open rate.

### 12. Rollout

`NEXT_PUBLIC_PUSH_ENABLED` in `env.ts`, **default `''` (off)**. This is the
opposite of onboarding's default on purpose: a half-configured push (no
VAPID key, no table) must fail as "the card is not there", not as a switch that
errors.

1. **Phase 0, spike (half a day).** Hand-made VAPID keys and a throwaway page
   on the dev site, then one `workflow_dispatch` send to:
   - an iPhone (Home Screen, iOS 26),
   - an Android phone (Chrome),
   - desktop Chrome.

   Confirms:
   - the mutable declarative path on iOS,
   - 1–3 fetches inside the push event,
   - the fallback when the worker throws.
2. **Phase 1.** `eventQuery.ts` extraction (behaviour pinned by the existing
   `eventsApi.spec.ts`), table and RPCs on `dev`, sender workflow.
3. **Phase 2.** Worker build, `usePushSettings`, UI on `/moje-filtry`, privacy
   text, analytics. Dev flag on.
4. **Phase 3.** Migration on `public`, prod flag on, schedule enabled.

## Testing

- **Unit (vitest):**
  - `pushSupport` for every row of the table above,
  - `digestWindow` (each saved window, including a past `fixed` range,
    Sunday evening, and a DST weekend),
  - `composeDigest` (each row of decision 4, the body length cap, Polish
    plural forms: 1 wydarzenie / 2 wydarzenia / 5 wydarzeń),
  - `usePushSettings` (an edited filter is mirrored, a deleted one is dropped,
    the cap at 3).
- **eventQuery extraction:** `eventsApi.spec.ts` unchanged and green is the
  test that the refactor preserved behaviour.
- **Worker:** the `push` handler with stubbed `fetch` and `registration`:
  - success → personalised notification,
  - timeout → fallback,
  - throw → fallback.

  Every path calls `showNotification` exactly once.
- **Sender:** `send-push-digest.mjs` against a stubbed `web-push`, covering
  each status code's effect on the row, and the Warsaw-17:00 gate on both DST
  sides.
- **SQL:** `push_subscribe` refuses a non-push host, plain http and oversized
  keys, and upserts a repeat. Run against the `dev` schema.
- **e2e (Playwright):** the `/moje-filtry` card with `PushManager` stubbed. No
  real push in CI.
- **Manual (phase 0 checklist, repeated before phase 3):** the three devices,
  plus "turn off, then no push next Thursday".

## Rejected

- **No server at all (Periodic Background Sync).** It works without a sender,
  but only in Chromium on Android, only for an installed app, and at a
  frequency the browser chooses. iOS has no background execution for web apps
  except push, so this would leave out every iPhone. It is worth adding later
  as an Android extra at most.
- **Notification Triggers (scheduled local notifications).** The origin trial
  ended and the API never shipped.
- **Server-side matching (filters uploaded with the subscription).** It is
  simpler and works the same on every platform, but it puts the visitor's
  preferences on the server, which is exactly what was ruled out.
- **OneSignal / FCM SDK.** Third-party script, consent surface, preferences
  on someone else's server.
- **A native wrapper (Capacitor / App Store).** Paid developer account, review,
  and guideline 4.2 risk for a wrapped website.
- **Alerts about new events.** The scraper rewrites rows under new ids, so
  "new" would need tracking per `event_key`. That is a lot of design for a
  notification that is more likely to annoy. Revisit once the weekly digest
  has an open rate to compare against.

## Open questions for the owner

1. The weekly day and hour (Thursday ~17:00 assumed).
2. Whether the sender lives in GitHub Actions (assumed) or a Supabase Edge
   Function. The trade-off is in decision 2.
3. The Supabase plan of the hub project (free-tier pausing).

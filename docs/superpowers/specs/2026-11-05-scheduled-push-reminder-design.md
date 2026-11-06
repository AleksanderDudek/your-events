# Scheduled push reminder — design

Date: 2026-11-05
Status: built on `feat/push-reminder` (2026-11-06), not deployed. Where the
build differs from the decisions below, "As built" at the end is current.
Replaces the 2026-11-04 weekly-digest design that stood at this path before
it was renamed (that one counted events on the phone; this one counts nothing).

## The request

> chciałbym, żeby ludzie mieli jakieś push notyfikacje na telefon natywnie.
> zastanawiam się nad jakimś service-workerem albo wykorzystaniem PWA.
> z tym, że jest to architektura next.js bazująca na statycznych stronach

Constraints added while designing:

> dla mnie ma to sens tylko wtedy, jeśli nie płacę za to, a całość bazuje na
> zapisach tego, co chce użytkownik. całość ma się odbywać z poziomu danych na
> telefonie.

> codziennie wysyła "zobacz jakie są nowe wydarzenia w twojej okolicy" + ktoś
> może to "nadpisać" [...] można oznaczyć 1 swój filtr [...] domyślnie po
> prostu kieruje użytkownika na główną stronę [...] zależy mi, żeby to się
> działo o 12:00, lokalnie z telefonu/komputera.

> chciałbym móc sterować w jakiś sposób tymi godzinami powiadomień [...] na
> start chcę w ndz i wt i czw wysyłać te powiadomienia o godz 12:00. chcę mieć
> to tak zrobione, żebym mógł zmieniać te terminy w łatwy sposób.

## What it does, in one paragraph

A visitor who turns notifications on gets a reminder on the days and at the
hours listed in one database table: to start, Sunday, Tuesday and Thursday at
12:00 **in the visitor's own timezone**. The reminder says "Zobacz, jakie są
nowe wydarzenia w Twojej okolicy" and opens the home page. A visitor who marks
**one** of their saved filters gets the same reminder named after that filter,
and it opens that filter instead. Nothing is counted or matched: the reminder
is a link.

## Decisions

### 1. The server rings the bell. The phone decides where it leads.

Push has two halves, and the design keeps them apart:

- **Delivery.** Somebody has to POST to the browser's push service (Google
  FCM, Mozilla autopush, Apple's web.push.apple.com) at the right minute. A
  static site cannot, and **no platform lets a web page schedule a
  notification on the device** (decision 12, "Rejected"). So there is a sender.
- **Content.** Which filter, what name, which link. This lives only on the
  phone.

| | Server (Supabase hub project) | Phone |
|---|---|---|
| Push endpoint + its two keys | yes (technically required) | yes |
| IANA timezone (`Europe/Warsaw`) | yes (needed to ring at local 12:00) | yes |
| When it last rang this device | yes (stops doubles) | no |
| The marked filter, its name, its id | **no** | yes |
| Saved filters, city, language | **no** | yes |

"Lokalnie z telefonu" is met where it can be: **the hour is the phone's hour**
and **the content is the phone's data**. Only the act of ringing comes from
outside, because nothing else can wake a phone that is not running the site.

### 2. The schedule is a table the owner edits

```sql
create table push_schedule (
  id          bigint generated always as identity primary key,
  weekday     smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday, 7 = Sunday
  local_time  time     not null check (local_time = date_trunc('minute', local_time)),
  enabled     boolean  not null default true,
  note        text,
  unique (weekday, local_time)
);
alter table push_schedule enable row level security;   -- no policies: not public

insert into push_schedule (weekday, local_time, note) values
  (7, '12:00', 'niedziela'),
  (2, '12:00', 'wtorek'),
  (4, '12:00', 'czwartek');
```

- **Changing a time:** Supabase dashboard, Table Editor, `push_schedule`; edit,
  add or delete a row. It applies at the next minute. No deploy, no commit.
- **Pausing one day:** untick `enabled`. The row and its note stay.
- **Pausing everything:** untick every row, or empty the table.
- **Each row is a time of its own.** Sunday 10:00 and Thursday 17:30 can
  coexist.
- **`local_time` is the visitor's wall clock**, so 12:00 stays 12:00 for
  someone in Warsaw across the October and March clock changes, and is 12:00
  in London for a visitor whose phone is in London.
- **Dev and prod have separate tables** (the `dev` and `public` schemas, like
  `events`). A test row three minutes from now on `dev` rings the dev site's
  subscribers and nobody else.
- `unique (weekday, local_time)` stops the same slot being entered twice.
  Entering it twice would not ring twice anyway (decision 4), but a duplicate
  row is a confusing thing to find later.
- `local_time` is whole minutes because the scheduler runs once a minute.
  `12:00:30` would read as a time the code honours and it would not.

Possible later, not built now: a `message` column for per-slot wording
("Weekend tuż-tuż" on Thursday). The column would travel in the payload; the
phone would still own the filter and the link.

### 3. The subscription table

```sql
create table push_subscriptions (
  endpoint        text primary key,
  p256dh          text not null,
  auth            text not null,
  tz              text not null default 'Europe/Warsaw',
  created_at      timestamptz not null default now(),
  last_slot_at    timestamptz,          -- the slot this device was last rung for
  last_ok_at      timestamptz,
  failure_count   int not null default 0
);
alter table push_subscriptions enable row level security;
-- no policies: anon can neither read nor write the table directly
```

Two RPCs, `security definer`, `execute` granted to `anon`, called with the
anon key through `supabase.rpc` (the page already has a client):

- `push_subscribe(endpoint, p256dh, auth, tz)`: upsert. It refuses:
  - an endpoint that is not `https://`,
  - an endpoint whose host is not a push service (`fcm.googleapis.com`,
    `*.push.services.mozilla.com`, `web.push.apple.com`,
    `*.notify.windows.com`). This keeps the table from becoming a free list of
    arbitrary URLs we POST to;
  - keys over 200 characters.

  A `tz` not in `pg_timezone_names` is stored as `Europe/Warsaw`, not refused:
  a wrong-hour reminder beats no subscription. A NEW row starts with
  `last_slot_at = now()`, so turning reminders on at 12:20 does not ring at
  once for the 12:00 slot. A repeat call keeps `last_slot_at`, so
  re-subscribing never rings twice for one slot.
- `push_unsubscribe(endpoint)`: delete. Knowing the endpoint is the
  capability: only the browser holding it knows it.

### 4. Which devices are due, and how a slot is rung exactly once

A slot is a schedule row placed on a calendar day in a device's timezone:
`(day + local_time) at time zone tz`, a real instant. A device is **due** when
some enabled slot on its local today or yesterday satisfies:

```
slot_at <= now()
and slot_at > now() - interval '60 minutes'      -- the catch-up window
and (last_slot_at is null or last_slot_at < slot_at)
```

- **Yesterday is included** so a 23:30 slot caught up at 00:10 still counts.
- **The 60-minute window** means a scheduler that was down for ten minutes
  still rings, late. One down for three hours does not: "zobacz nowe
  wydarzenia" at 15:00 for a 12:00 slot is worse than nothing.
- **`last_slot_at` is the idempotency key.** It is written when a device is
  claimed, before it is sent to. Two overlapping runs, a retried run, an
  ambiguous hour on the autumn clock change, a duplicate subscribe call: each
  finds the slot already claimed. The trade is deliberate: a send that fails
  after its claim is lost for that slot (**at most once**), because a
  reminder that arrives twice is how notifications get turned off.
- **A spring-forward hour that does not exist** (02:30 on the March change) is
  resolved by Postgres to a real instant. Only relevant if the owner ever
  schedules in the night.

Three SQL functions in each schema, all `security definer`, **none** granted
to `anon`:

| Function | Does | Called by |
|---|---|---|
| `push_any_due() returns boolean` | the predicate above, `exists`, nothing written | the cron tick, every minute |
| `push_claim_due(batch int) returns setof (endpoint, p256dh, auth)` | `update ... set last_slot_at = slot_at ... from (select ... for update skip locked limit batch) returning ...` | the Edge Function |
| `push_record(endpoint, status int)` | applies one send result (decision 6) | the Edge Function |

`push_any_due` and `push_claim_due` both read one function,
`push_due_rows(p_at timestamptz default now())`, so the two can never disagree
about what is due, and tests can pass any instant as `p_at`.

### 5. What runs every minute, and what runs only when needed

```
pg_cron  * * * * *  ──►  push_tick('public')   ──► push_any_due()? ── no ──► done (1 query)
                         push_tick('dev')                 │
                                                          yes
                                                          ▼
                                    pg_net.http_post(Edge Function `push-send`, {schema})
                                                          │
                                    push-send: loop push_claim_due(500) → send → push_record
```

- **`pg_cron` and `pg_net` are already installed** in the hub project
  (checked 2026-11-04: `pg_cron` 1.6.4, `pg_net` 0.20.0, `vault`).
- **The minute tick is plain SQL.** On a minute with nothing due it is one
  `exists` query and nothing else. The Edge Function starts only when somebody
  is due: with three slots a week that is a handful of invocations a week.
- **The function claims, sends, records, and repeats** until a claim returns
  nothing, so one invocation drains a slot of any size. If a run hits the
  function time limit, the unclaimed rows are still due and the next minute's
  tick picks them up.
- **Authentication between the two:** a random `PUSH_CRON_SECRET` stored in
  Vault (read by `push_tick`) and as an Edge Function secret (compared by
  `push-send`, constant time). The function is deployed with JWT verification
  off and refuses any request without the header. The service-role key never
  leaves Supabase.
- One function serves both schemas. The schema comes from the request body,
  checked against `public` / `dev`, and decides which site the link points to
  (`SITE_URL_PUBLIC=https://idznamiasto.pl`,
  `SITE_URL_DEV=https://aleksanderdudek.github.io/your-events`).

### 6. Sending

- VAPID keys: private key as an Edge Function secret; public key as
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, added to `env.ts`.
- Headers: `TTL: 21600` (6 hours: a phone that is off at noon still gets the
  reminder the same afternoon, never the next morning), `Urgency: high` (Android
  delivers immediately even in Doze; the reminder is time-specific).
- Concurrency 20 inside the function.
- Results, through `push_record`:
  - `201`: set `last_ok_at`, reset `failure_count`.
  - `404` / `410`: delete the row. The browser dropped the subscription.
  - `429` / `5xx` / network error: `failure_count + 1`. A row at 5 consecutive
    failures, or with no success for 60 days, is deleted.
- Logs counts only (claimed / sent / gone / failed), never endpoints.

**Library: needs the phase 0 spike.** `web-push` (npm) is the reference
implementation but leans on Node `crypto`/`https`; under Deno it is imported
as `npm:web-push` and may or may not work. Fallback: `jsr:@negrel/webpush`,
written for Deno and Web Crypto. If neither encrypts correctly for all three
push services, the sender moves to a GitHub Actions job running Node, with the
same SQL functions (decision 12 records that alternative).

### 7. The payload: one for everybody, rewritten on the phone

Every device gets the same **Declarative Web Push** payload:

```json
{
  "web_push": 8030,
  "notification": {
    "title": "Idź na miasto",
    "body": "Zobacz, jakie są nowe wydarzenia w Twojej okolicy",
    "navigate": "https://idznamiasto.pl/?src=push",
    "lang": "pl"
  },
  "mutable": true
}
```

- It carries no personal data and no filter. The origin comes from the schema
  (decision 5), never from a client.
- **Chrome, Firefox, Edge** have no declarative support and hand it to the
  service worker as an ordinary push. The worker builds the notification
  (decision 8).
- **Safari 18.4+ (iOS, macOS)** shows it declaratively. With `mutable: true`
  it first offers it to the service worker to rewrite, and if the worker fails
  or is slow, Safari shows the payload as it is. **A notification always
  appears**, which matters twice: Chrome shows its own "this site has been
  updated in the background" if none does, and Safari revokes a subscription
  after a few silent pushes.

### 8. The service worker

A small hand-written `public/push-sw.js`, no build step: it needs no shared
code from `src/`, because it only reads one record and opens one link.

On `push`:

1. Parse the payload; read `settings` from IndexedDB (`idznamiasto-push`).
2. Compose:

   | Phone has | Title | Body | Opens |
   |---|---|---|---|
   | no marked filter | `Idź na miasto` | `Zobacz, jakie są nowe wydarzenia w Twojej okolicy` | `/?src=push` |
   | a marked filter "Taniec w weekend" | `Taniec w weekend` | `Zobacz, co nowego pasuje do tego filtra` | `/moje-filtry/?open=<id>&src=push` |
   | IndexedDB unreadable | the payload as received | | `/?src=push` |

   English strings come from the same small table in the worker, keyed by the
   stored `locale`. A filter name is cut to 60 characters.
3. `showNotification(title, { body, icon, badge, tag: 'reminder', data: { url } })`.
   `tag` makes a newer reminder replace an unread older one rather than stack.

On `notificationclick`: focus an open tab of the site and navigate it to
`data.url`, or open a new window.

On `activate`: delete caches left by the retired Vite PWA worker (today's
`public/sw.js` does this) but **do not unregister**. The worker intercepts no
`fetch`: it is a push worker, not an offline cache. `public/sw.js` stays as it
is until old visits age out.

**Why the filter link goes through `/moje-filtry`** rather than straight to
the filter's list: a filter's link depends on the day it is opened
(`presetHref(preset, now)` resolves "Dziś" and "W weekend" against now), and
the filter may have been edited since the phone last wrote IndexedDB. The page
reads the current filter from `localStorage` and resolves it at the moment of
the tap. `/moje-filtry` gains one effect: with `?open=<id>` it calls
`router.replace(presetHref(preset, new Date()))`; with an id that no longer
exists it stays on the list, which is the most useful page to land on.

### 9. What the phone stores

The page mirrors exactly this into IndexedDB, because a service worker cannot
read `localStorage`:

```ts
interface PushSettings {
  locale: 'pl' | 'en';
  preset: { id: string; name: string } | null;   // the marked filter, at most one
}
```

- Written by a small `usePushSettings` hook. `usePresets.save` updates the
  stored name when the marked filter is renamed; `usePresets.remove` clears
  `preset` when the marked filter is deleted, so the next reminder falls back
  to the home page.
- The record lives only while notifications are on. Turning them off deletes
  it.
- No Supabase config, no city and no filter contents on IndexedDB: the worker
  never queries anything.

### 10. Where the visitor turns it on

Permission is asked **only after a click that asks for it**. A prompt on page
load gets "Block", and a block cannot be undone from the page.

- **`/moje-filtry`, at the top:** a card "Przypomnienia" with one switch and
  one line saying when they come. The line is not hard-coded (the owner can
  change the schedule at any time): it reads "Kilka razy w tygodniu, w
  południe" until the schedule is exposed (open question 2).
- **Each filter card:** a bell "Przypominaj o tym filtrze". Marking one
  unmarks any other, like a radio. Marking one while notifications are off
  turns them on first (with the permission prompt).
- **After saving a filter:** a snackbar "Przypominać Ci o tym filtrze?". This
  is the natural moment: the visitor has just said what they want.
- **The switch is the off switch.** It calls `subscription.unsubscribe()` and
  `push_unsubscribe`, then deletes the IndexedDB record. Removing the site's
  data in the browser does the same from the browser's side; the server row
  then expires on its first `410`.
- On every visit with notifications on, the page re-sends `push_subscribe`
  once per session, which refreshes `tz` (a visitor who moved timezones) and
  replaces a subscription the browser rotated.

**Platform branches** (pure `pushSupport(navigator, window)`):

| Result | When | What the switch does |
|---|---|---|
| `ready` | `PushManager` + `serviceWorker` + `Notification` present | registers the worker, asks permission, subscribes |
| `ios-install-first` | iOS/iPadOS Safari, not standalone | a sheet: Share, "Do ekranu początkowego", open from the icon. iOS 26 opens every Home Screen site as a web app, and `manifest.ts` already makes ours a proper one |
| `blocked` | `Notification.permission === 'denied'` | explains how to unblock in browser settings |
| `unsupported` | anything else | the card is hidden |

**Registration:** `navigator.serviceWorker.register(withBasePath('/push-sw.js'),
{ scope: withBasePath('/') })`.

### 11. Privacy page, analytics, cost

**`/prywatnosc` gains a section:**

- stored on our side: a technical push address, two keys, the timezone and
  when the last reminder went out; no filters, no preferences;
- stored on the phone: which filter is marked and its name;
- how to delete it: the switch, or removing the site's data.

The browser's permission prompt is the consent for push. It does not depend
on the cookie banner, while the Clarity events below still do.

**Clarity events** through `trackEvent`:

- `push_enable`, `push_disable`, `push_ios_install_shown`, `push_denied`,
  `push_filter_on`, `push_filter_off`;
- `push_open`: fired on load when `src=push` is in the URL, then stripped
  with `history.replaceState`, so a shared link does not count again.

`push-send`'s per-run sent count is the audience; `push_open` / sent is the
open rate.

**Cost: 0 zł.**

| Piece | Cost |
|---|---|
| Push services (FCM, Mozilla, Apple) | free, no account, VAPID keys only |
| Two small tables, `pg_cron`, `pg_net` | inside the existing hub project |
| Edge Function | a handful of invocations a week; the free tier is 500,000 a month |

To check before phase 3: the hub project's plan. A free project pauses after
a week without traffic; the scrape pipeline keeps this one busy, and the
minute tick itself counts as activity.

### 12. Rejected

- **Scheduling on the device.** Notification Triggers (show a notification at a
  time) ended its origin trial and never shipped. Periodic Background Sync is
  Chromium-only, installed-app-only, and runs when the browser chooses, not at
  12:00. iOS gives a web app no background time except a push. There is no way
  to make a phone ring itself at a time.
- **GitHub Actions as the sender.** Free for this public repository, and Node
  runs `web-push` without question. But a scheduled run can start up to an hour
  late at peak times, which misses "o 12:00", and a minute-precision schedule
  would mean a workflow every minute. Kept as the fallback if the Deno spike
  fails (decision 6), with a `*/5` cron and the same catch-up window.
- **The schedule in code or in the cron expression.** Each change would be a
  commit and a deploy, and per-timezone local hours cannot be one cron
  expression anyway.
- **Counting matching events on the phone** (the 2026-11-04 design). Accurate
  but heavy: an extracted query module, a bundled worker, four-second fetch
  budgets on iOS. A link that says "look" asks the phone for nothing and cannot
  be wrong.
- **Server-side matching** (filters uploaded with the subscription): puts the
  visitor's preferences on the server, which was ruled out.
- **OneSignal / FCM SDK:** third-party script, consent surface, preferences on
  someone else's server.
- **A native wrapper (Capacitor / App Store):** paid developer account, review,
  and guideline 4.2 risk for a wrapped website.

### 13. Rollout

`NEXT_PUBLIC_PUSH_ENABLED` in `env.ts`, **default `''` (off)**: a
half-configured push (no VAPID key, no table) must fail as "the card is not
there", never as a switch that errors.

1. **Phase 0, spike (half a day).** VAPID keys, `push_subscriptions` on `dev`,
   `push-send` deployed, a throwaway subscribe page on the dev site, one
   `push_schedule` row three minutes ahead. Devices: an iPhone (Home Screen,
   iOS 26), an Android phone (Chrome), desktop Chrome. Confirms:
   - which web-push library encrypts correctly under Deno for all three
     services (decision 6);
   - the mutable declarative path on iOS rewrites the title and link;
   - the declarative payload shows when the worker throws;
   - the reminder lands within a minute of the slot.
2. **Phase 1.** Tables, functions and cron on `dev`; `push-send` final.
3. **Phase 2.** Worker, `usePushSettings`, `pushSupport`, the `/moje-filtry`
   card, bells, snackbar and `?open=` effect, privacy text, analytics. Dev
   flag on.
4. **Phase 3.** Migration on `public` with the three seed rows, prod flag on.

## Testing

- **SQL (against `dev`):**
  - `push_subscribe` refuses http, a non-push host and oversized keys; upserts
    a repeat without touching `last_slot_at`; stores an unknown `tz` as
    `Europe/Warsaw`.
  - `push_due_rows(p_at)`: a
    Warsaw device at 11:59 / 12:00 / 12:59 / 13:01 on a Tuesday; a Monday (not
    due); a London device at Warsaw's 12:00 (not due) and at London's 12:00
    (due); a disabled row (not due); a 23:30 slot caught up at 00:10 (due);
    both sides of the October clock change.
  - `push_claim_due` twice in a row for one slot: the second returns nothing.
  - `push_record` for each status code's effect on the row.
- **Edge Function (Deno test):** auth refused without or with a wrong
  secret; an unknown schema refused; claim, send, record loop with a stubbed
  sender; logs carry no endpoint.
- **Unit (vitest):**
  - `pushSupport` for every row of its table;
  - `usePushSettings`: marking one unmarks the other, a rename updates the
    name, a delete clears the mark, turning off deletes the record;
  - the `/moje-filtry?open=` effect: a known id redirects to `presetHref`, an
    unknown id stays.
- **Worker:** the `push` handler with stubbed IndexedDB and `registration`:
  no filter, a filter, unreadable IndexedDB, English. Every path calls
  `showNotification` exactly once.
- **e2e (Playwright):** the `/moje-filtry` card and bells with `PushManager`
  stubbed. No real push in CI.
- **Manual (phase 0 checklist, repeated before phase 3):** the three devices;
  a schedule edit taking effect within a minute; "turn off, then nothing at
  the next slot".

## As built (2026-11-06)

Differences between the decisions above and the code on `feat/push-reminder`.
Where they disagree, this section is current.

**Server**
- **Sender:** `npm:web-push@3.6.7` under Deno. The fallbacks (`@negrel/webpush`,
  GitHub Actions) were not needed. It has not yet been run against a real
  browser (that is the plan's Task 5). Locally Deno needs
  `--node-modules-dir=none`, because the repository root has a `package.json`.
- **Send options:** a 15 s timeout per push. One hung connection would
  otherwise stall the whole batch.
- **Batches:** 200 devices per claim, not 500, so a batch stays below
  PostgREST's `max_rows`. Rows past that limit would be claimed but never sent.
- **Function config:** the function reads `PUSH_CRON_SECRET` and `SITE_URL_*`
  per request and refuses through its own 401/500. It never crashes on a
  missing value.
- **Failed run:** if a claim fails mid-run, the function still logs its counts
  and answers `500 {error: 'claim', ...counts}`.
- **Tick:** one parameterless `push_tick()` per schema (cron jobs
  `push-tick-public` and `push-tick-dev`), not `push_tick('public')`.

**Database**
- **Function privileges:** `push_due_rows` and `push_any_due` are plain
  functions with no grants. Only functions that need it are `security definer`.
- **What `push_subscribe` also refuses:**
  - an endpoint containing a backslash, `@` or whitespace, or whose host is not
    plain `[a-z0-9.-]`. Without this, `https://evil.com\x.notify.windows.com/`
    passed the host allowlist and web-push would have sent to `evil.com`. The
    sender re-checks the host before every send and answers 410 for a bad one;
  - empty keys;
  - endpoints over 1000 characters;
  - new rows once the table holds 50,000 (an abuse ceiling).
- **Timezones:** a trigger stores `Europe/Warsaw` for any `tz` the database
  does not know, however the row was written. One bad zone would otherwise make
  the minute check fail for everybody.

**Service worker**
- **Notification options:** `icon` only, no `badge`: there is no monochrome
  badge asset yet.
- **Reading the stored settings:** at most 3 s (`onblocked` counts as no
  record). After that the worker shows the payload as received.
- **Caches:** on activate the worker deletes only this site's old Workbox
  caches (`workbox-*` names containing its scope). The dev site's origin is
  shared with other GitHub Pages projects.

**Page**
- **The hook:** `usePushReminder`, not `usePushSettings`. A rename or delete of
  the marked filter reaches IndexedDB through an effect, not through
  `usePresets.save`/`remove`. So it happens while `/moje-filtry` or a save
  button is mounted, which covers every edit path today.
- **Rotated VAPID key:** `ensureSubscription` handles it. A subscription made
  with another key is unsubscribed and made again, on enable and on the
  once-per-session refresh.
- **After saving a filter:** the existing "Zapisano" toast gets a "Przypominaj
  o nim" action, instead of a separate question. A failure there, or from a
  bell, shows `PUSH_FAILED`.
- **The card:** two sentences (when the reminders come, what the bell does).
  While the check runs, the card shows its text without the switch, so nothing
  jumps. The switch and the bells use `aria-disabled` while busy, so they keep
  keyboard focus.
- **Privacy page:** it also names the sign-up date and the failed-delivery
  counter. It says that removing site data deletes the address at the next
  reminder, not at once.

## Open questions for the owner

1. The exact wording of the two notifications (decision 8). The draft uses the
   phrase from the request.
2. Whether the card on `/moje-filtry` should show the actual days ("ndz, wt,
   czw o 12:00"). That needs the schedule readable by the page (a public RPC
   returning enabled rows) and means a schedule edit also changes the card.
   Assumed **no** for now, with the generic line from decision 10.
3. The hub project's Supabase plan (decision 11).

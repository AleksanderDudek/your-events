# Scheduled Push Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors who switch reminders on get a web push at the days and hours listed in a Supabase table (Sunday, Tuesday and Thursday at 12:00 to start, in their own timezone). The push opens the home page, or the one saved filter the visitor marked with a bell.

**Architecture:**
- **Database.** Two tables and a handful of SQL functions, created in both schemas of the hub project (`public` = prod, `dev` = dev).
- **Scheduler.** `pg_cron` runs a cheap SQL check every minute. Only when a device is due does `pg_net` call the Edge Function `push-send`.
- **Sender.** `push-send` claims the due devices (each device exactly once per slot), sends every one of them the same Declarative Web Push payload, and records each result.
- **Phone.** A hand-written service worker (`public/push-sw.js`) rewrites that payload using one IndexedDB record that holds the locale and the marked filter.
- **UI.** The page owns the controls on `/moje-filtry`.

Spec: `docs/superpowers/specs/2026-11-05-scheduled-push-reminder-design.md`.

**Tech Stack:**
- Next.js 16 (static export), React 19, MUI 7
- Tests: vitest + Testing Library, Playwright
- Supabase: Postgres 17, pg_cron, pg_net, Vault, Edge Functions on Deno
- `npm:web-push`
- `fake-indexeddb` (tests only)
- Docker (only for the local SQL tests)

---

## Ground rules for whoever executes this

- **Work in a worktree** (Task 0). Never switch the branch of `~/Projects/your-events` itself.
- **Commit after every task.** End each commit message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Do not push**
  unless the owner asks.
- **Secrets never go into the repo, the chat or terminal output.** That covers
  the VAPID private key, `PUSH_CRON_SECRET` and the service-role key. A step
  that creates a secret either writes it to a file outside the repo or has the
  owner paste it into a dashboard.
- **Tasks 1-19** are code and touch nothing live.
- **Task 20** changes the **dev** schema of the live Supabase project, so the
  owner must be present.
- **Task 21** is production and runs **only after the owner explicitly says go**.
- To run one test file: `pnpm vitest run <path>`. There is no coverage gate,
  so the exit code tells you whether it passed.

## File map

**SQL (`supabase/push/`, schema-templated with `__SCHEMA__`)**
- `core.sql`: both tables, every function and all grants. Plain Postgres, so it can be tested locally.
- `seed.sql`: the three starting schedule rows.
- `cron.sql`: Supabase only. `push_tick()` (Vault + pg_net) and its `cron.schedule`.
- `tests.sql`: assertion tests in one transaction that rolls back.
- `scripts/push-sql.sh`: prints a file with `__SCHEMA__` replaced.
- `scripts/test-push-sql.sh`: runs `core.sql` and `tests.sql` in a throwaway Docker Postgres.

**Edge Function (`supabase/functions/push-send/`)**
- `handler.ts`: pure request handling (auth, schema, the claim/send/record loop, the payload).
- `handler.test.ts`: Deno tests.
- `sender.ts`: the web-push adapter.
- `index.ts`: wiring (env, Supabase client, `Deno.serve`).
- `scripts/push-spike/`: a manual tool that sends a real push to desktop Chrome on localhost.

**Front end**
- New config:
  - `src/config/env.ts`, `src/config/site.ts`: `NEXT_PUBLIC_PUSH_ENABLED`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `IS_PUSH_ENABLED`.
- New logic:
  - `src/lib/pushSupport.ts`: pure platform check.
  - `src/lib/pushSettingsStore.ts`: the IndexedDB record shared with the worker.
  - `src/lib/pushMark.ts`: pure rules for marking a filter and keeping the mark in step.
  - `src/lib/pushOpen.ts`: pure helpers for `?src=push` and `?open=`.
  - `src/lib/pushClient.ts`: browser plumbing (register, permission, subscribe, RPCs).
  - `src/components/service/usePushReminder.ts`: the hook every UI piece uses.
- New worker:
  - `public/push-sw.js`: the service worker. Tested by `src/lib/pushSw.spec.ts`.
- New components:
  - `src/components/common/PushReminderCard/{PushReminderCard,IosInstallDialog}.tsx`
  - `src/components/common/PushOpenTracker/PushOpenTracker.tsx`
- Modified files:
  - `MyFiltersView.tsx`, `SavePresetButton.tsx`, `PrivacyView.tsx`, `providers.tsx`, `messages.ts`
  - `usePresets.ts` (one new export)
  - `public/sw.js` (comment only)

**Config and docs**
- `tsconfig.json`, `vitest.config.ts`: keep the Deno code out of tsc and vitest.
- `playwright.config.ts`: push flags for the e2e server.
- `.github/workflows/{ci,deploy-dev,deploy-prod}.yml`: two new build vars.
- `docs/DEPLOYMENT.md`: a "Push reminders" section.

---

### Task 0: Worktree and keeping Deno code out of the Node toolchain

**Files:**
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Create the worktree from the spec branch**

```bash
cd ~/Projects/your-events
git worktree add ../your-events-push -b feat/push-reminder docs/web-push-digest-spec
cd ../your-events-push
pnpm install
```

Expected: a new folder `~/Projects/your-events-push` on branch `feat/push-reminder`. Run every later command from that folder.

- [ ] **Step 2: Exclude `supabase/` from tsc**

The Edge Function imports `npm:` and `jsr:` specifiers, which Node's TypeScript cannot resolve. `tsconfig.json` includes `**/*.ts`, so it would try. In `tsconfig.json`, change the `exclude` array to:

```json
  "exclude": [
    "node_modules",
    "playwright.config.ts",
    "playwright.export.config.ts",
    "vitest.config.ts",
    "e2e",
    "e2e-export",
    "supabase",
    "scripts/push-spike"
  ]
```

- [ ] **Step 3: Exclude `supabase/` from vitest**

In `vitest.config.ts`, replace the `exclude` line with:

```ts
    // Both e2e suites are Playwright's (dev server / static export). supabase/
    // holds Deno code with its own `deno test`.
    exclude: ['e2e/**', 'e2e-export/**', 'node_modules/**', 'supabase/**', 'scripts/**'],
```

- [ ] **Step 4: Verify nothing else changed**

Run: `pnpm type-check && pnpm test`
Expected: both pass, with the same test count as on `main`.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json vitest.config.ts
git commit -m "chore: keep supabase/ Deno code out of tsc and vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: SQL core (tables, functions, grants) with local tests

**Files:**
- Create: `scripts/push-sql.sh`
- Create: `scripts/test-push-sql.sh`
- Create: `supabase/push/tests.sql`
- Create: `supabase/push/core.sql`

- [ ] **Step 1: Write the template printer**

`scripts/push-sql.sh`:

```bash
#!/usr/bin/env bash
# Prints a supabase/push/*.sql file with __SCHEMA__ replaced, ready to paste
# into the Supabase SQL editor or pipe into psql.
# Usage: scripts/push-sql.sh <public|dev> <file.sql>
set -euo pipefail
case "${1:-}" in
  public|dev) ;;
  *) echo "usage: $0 <public|dev> <file.sql>" >&2; exit 2 ;;
esac
sed "s/__SCHEMA__/$1/g" "$2"
```

- [ ] **Step 2: Write the local test runner**

`scripts/test-push-sql.sh`:

```bash
#!/usr/bin/env bash
# Runs supabase/push/core.sql + tests.sql against a throwaway Postgres 17 in
# Docker. Supabase-only pieces (pg_cron, pg_net, Vault) live in cron.sql and
# are not part of this run.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="push-sql-test-$$"
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
trap 'docker stop "$NAME" >/dev/null 2>&1 || true' EXIT

# The image's init runs a temporary server on the Unix socket only; TCP answers
# once the real server is up.
for _ in $(seq 1 60); do
  if docker exec "$NAME" psql -U postgres -h 127.0.0.1 -c 'select 1' >/dev/null 2>&1; then break; fi
  sleep 1
done

run() { docker exec -i "$NAME" psql -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -q; }

run <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema dev;
SQL
scripts/push-sql.sh dev supabase/push/core.sql | run
scripts/push-sql.sh dev supabase/push/tests.sql | run
echo "push SQL tests passed"
```

Then:

```bash
chmod +x scripts/push-sql.sh scripts/test-push-sql.sh
```

- [ ] **Step 3: Write the failing tests**

`supabase/push/tests.sql`:

```sql
-- Assertion tests for core.sql. Everything runs in ONE transaction that rolls
-- back, so this file can also be pasted into the Supabase SQL editor against
-- the dev schema without leaving anything behind.
-- Dates: November 2026, Warsaw = UTC+1, London = UTC+0.
-- 2026-11-08 Sun, 2026-11-09 Mon, 2026-11-10 Tue, 2026-11-12 Thu.
begin;

truncate __SCHEMA__.push_schedule, __SCHEMA__.push_subscriptions;
insert into __SCHEMA__.push_schedule (weekday, local_time) values
  (7, '12:00'), (2, '12:00'), (4, '12:00');
insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth, tz) values
  ('https://fcm.googleapis.com/fcm/send/warsaw', 'k', 'a', 'Europe/Warsaw'),
  ('https://fcm.googleapis.com/fcm/send/london', 'k', 'a', 'Europe/London');

-- Which test devices are due at an instant, as a short sorted list.
create function pg_temp.due(p_at timestamptz) returns text language sql as $$
  select coalesce(string_agg(replace(endpoint, 'https://fcm.googleapis.com/fcm/send/', ''), ',' order by endpoint), '')
  from __SCHEMA__.push_due_rows(p_at)
$$;

-- 1. The due window, per timezone.
do $$ begin
  assert pg_temp.due('2026-11-10 10:59+00') = '', 'Tue 11:59 Warsaw: nothing yet';
  assert pg_temp.due('2026-11-10 11:00+00') = 'warsaw', 'Tue 12:00 Warsaw: Warsaw due';
  assert pg_temp.due('2026-11-10 11:59+00') = 'warsaw', 'Tue 12:59 Warsaw: still inside the catch-up window';
  assert pg_temp.due('2026-11-10 12:00+00') = 'london', 'Tue 13:00 Warsaw = 12:00 London';
  assert pg_temp.due('2026-11-10 12:01+00') = 'london', 'Warsaw slot is past the 60-minute window';
  assert pg_temp.due('2026-11-09 11:00+00') = '', 'Monday is not in the schedule';
end $$;

-- 2. Both sides of the October clock change (2026-10-25, Sundays).
do $$ begin
  assert pg_temp.due('2026-10-18 10:00+00') = 'warsaw', 'Sun 12:00 CEST is 10:00 UTC';
  assert pg_temp.due('2026-10-25 10:00+00') = '', 'after the change 10:00 UTC is 11:00 in Warsaw';
  assert pg_temp.due('2026-10-25 11:00+00') = 'warsaw', 'Sun 12:00 CET is 11:00 UTC';
  assert pg_temp.due('2026-10-25 12:00+00') = 'london', 'London 12:00 GMT';
end $$;

-- 3. A disabled row rings nobody; enabling it again restores it.
do $$ begin
  update __SCHEMA__.push_schedule set enabled = false where weekday = 2;
  assert pg_temp.due('2026-11-10 11:00+00') = '', 'disabled Tuesday';
  update __SCHEMA__.push_schedule set enabled = true where weekday = 2;
  assert pg_temp.due('2026-11-10 11:00+00') = 'warsaw', 'enabled again';
end $$;

-- 4. A late-evening slot is caught up after local midnight.
do $$ begin
  insert into __SCHEMA__.push_schedule (weekday, local_time) values (2, '23:30');
  -- Tue 23:30 Warsaw = 22:30 UTC. At 23:10 UTC it is Wed 00:10 in Warsaw.
  assert pg_temp.due('2026-11-10 23:10+00') = 'warsaw', 'caught up across midnight';
  delete from __SCHEMA__.push_schedule where local_time = '23:30';
end $$;

-- 5. Schedule constraints.
do $$ begin
  begin
    insert into __SCHEMA__.push_schedule (weekday, local_time) values (2, '12:00');
    raise exception 'duplicate slot was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into __SCHEMA__.push_schedule (weekday, local_time) values (1, '12:00:30');
    raise exception 'a time with seconds was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into __SCHEMA__.push_schedule (weekday, local_time) values (8, '12:00');
    raise exception 'weekday 8 was accepted';
  exception when check_violation then null;
  end;
end $$;

-- 6. push_subscribe: what it refuses.
create function pg_temp.refused(p_endpoint text, p_key text, p_auth text) returns boolean
language plpgsql as $$
begin
  perform __SCHEMA__.push_subscribe(p_endpoint, p_key, p_auth, 'Europe/Warsaw');
  return false;
exception when invalid_parameter_value then
  return true;
end $$;

do $$ begin
  assert pg_temp.refused('http://fcm.googleapis.com/fcm/send/x', 'k', 'a'), 'plain http';
  assert pg_temp.refused('https://evil.example.com/x', 'k', 'a'), 'not a push service';
  assert pg_temp.refused('https://fcm.googleapis.com.evil.com/x', 'k', 'a'), 'look-alike host';
  assert pg_temp.refused('https://fcm.googleapis.com/fcm/send/x', repeat('k', 201), 'a'), 'oversized key';
  assert pg_temp.refused('https://fcm.googleapis.com/fcm/send/x', '', 'a'), 'empty key';
  assert pg_temp.refused('https://fcm.googleapis.com/fcm/send/x', 'k', ''), 'empty auth';
  assert not pg_temp.refused('https://updates.push.services.mozilla.com/wpush/v2/x', 'k', 'a'), 'Mozilla';
  assert not pg_temp.refused('https://web.push.apple.com/x', 'k', 'a'), 'Apple';
  assert not pg_temp.refused('https://db5p.notify.windows.com/w/?token=x', 'k', 'a'), 'Windows';
end $$;

-- 7. push_subscribe: what it stores.
do $$
declare r record;
begin
  perform __SCHEMA__.push_subscribe('https://fcm.googleapis.com/fcm/send/new', 'k', 'a', 'Europe/Lisbon');
  select * into r from __SCHEMA__.push_subscriptions where endpoint like '%/new';
  assert r.tz = 'Europe/Lisbon', 'valid tz kept';
  assert r.last_slot_at = now(), 'a new row does not ring for a slot that already passed';

  perform __SCHEMA__.push_subscribe('https://fcm.googleapis.com/fcm/send/new2', 'k', 'a', 'Mars/Olympus');
  assert (select tz from __SCHEMA__.push_subscriptions where endpoint like '%/new2') = 'Europe/Warsaw',
    'unknown tz falls back to Warsaw';

  update __SCHEMA__.push_subscriptions set last_slot_at = '2026-01-01 00:00+00' where endpoint like '%/new';
  perform __SCHEMA__.push_subscribe('https://fcm.googleapis.com/fcm/send/new', 'k2', 'a2', 'Europe/Warsaw');
  select * into r from __SCHEMA__.push_subscriptions where endpoint like '%/new';
  assert r.last_slot_at = '2026-01-01 00:00+00', 'a repeat keeps last_slot_at';
  assert r.p256dh = 'k2' and r.auth = 'a2' and r.tz = 'Europe/Warsaw', 'a repeat refreshes keys and tz';

  perform __SCHEMA__.push_unsubscribe('https://fcm.googleapis.com/fcm/send/new');
  assert not exists (select 1 from __SCHEMA__.push_subscriptions where endpoint like '%/new'), 'unsubscribed';
  delete from __SCHEMA__.push_subscriptions where endpoint like '%/new2';
end $$;

-- 8. push_record.
do $$
declare r record;
begin
  insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth, failure_count)
    values ('https://fcm.googleapis.com/fcm/send/r', 'k', 'a', 2);
  perform __SCHEMA__.push_record('https://fcm.googleapis.com/fcm/send/r', 201, '2026-11-10 11:00+00');
  select * into r from __SCHEMA__.push_subscriptions where endpoint like '%/r';
  assert r.last_ok_at = '2026-11-10 11:00+00' and r.failure_count = 0, 'success resets failures';

  for i in 1..4 loop
    perform __SCHEMA__.push_record('https://fcm.googleapis.com/fcm/send/r', 503, '2026-11-10 11:00+00');
  end loop;
  assert (select failure_count from __SCHEMA__.push_subscriptions where endpoint like '%/r') = 4, 'four failures kept';
  perform __SCHEMA__.push_record('https://fcm.googleapis.com/fcm/send/r', 0, '2026-11-10 11:00+00');
  assert not exists (select 1 from __SCHEMA__.push_subscriptions where endpoint like '%/r'), 'fifth failure deletes';

  insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth) values
    ('https://fcm.googleapis.com/fcm/send/g410', 'k', 'a'),
    ('https://fcm.googleapis.com/fcm/send/g404', 'k', 'a');
  perform __SCHEMA__.push_record('https://fcm.googleapis.com/fcm/send/g410', 410, '2026-11-10 11:00+00');
  perform __SCHEMA__.push_record('https://fcm.googleapis.com/fcm/send/g404', 404, '2026-11-10 11:00+00');
  assert not exists (select 1 from __SCHEMA__.push_subscriptions where endpoint like '%/g4%'), '404 and 410 delete';

  insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth, last_ok_at)
    values ('https://fcm.googleapis.com/fcm/send/old', 'k', 'a', '2026-08-01 00:00+00');
  perform __SCHEMA__.push_record('https://fcm.googleapis.com/fcm/send/old', 503, '2026-11-10 11:00+00');
  assert not exists (select 1 from __SCHEMA__.push_subscriptions where endpoint like '%/old'), '60 days without success deletes';
end $$;

-- 9. Claiming: exactly once per slot, in batches.
do $$
declare n int;
begin
  insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth, tz)
    values ('https://fcm.googleapis.com/fcm/send/warsaw2', 'k', 'a', 'Europe/Warsaw');
  assert __SCHEMA__.push_any_due('2026-11-10 11:00+00'), 'something is due';

  select count(*) into n from __SCHEMA__.push_claim_due(1, '2026-11-10 11:00+00');
  assert n = 1, 'batch of one';
  select count(*) into n from __SCHEMA__.push_claim_due(500, '2026-11-10 11:01+00');
  assert n = 1, 'the rest';
  select count(*) into n from __SCHEMA__.push_claim_due(500, '2026-11-10 11:05+00');
  assert n = 0, 'a claimed slot is never claimed again';
  assert not __SCHEMA__.push_any_due('2026-11-10 11:05+00'), 'nothing due after claiming';
  assert pg_temp.due('2026-11-12 11:00+00') = 'warsaw,warsaw2', 'Thursday is a new slot';
end $$;

-- 10. Grants: anon may subscribe and unsubscribe, nothing else.
do $$ begin
  assert has_function_privilege('anon', '__SCHEMA__.push_subscribe(text,text,text,text)', 'execute'), 'anon subscribe';
  assert has_function_privilege('anon', '__SCHEMA__.push_unsubscribe(text)', 'execute'), 'anon unsubscribe';
  assert not has_function_privilege('anon', '__SCHEMA__.push_claim_due(integer,timestamptz)', 'execute'), 'anon claim';
  assert not has_function_privilege('anon', '__SCHEMA__.push_record(text,integer,timestamptz)', 'execute'), 'anon record';
  assert not has_function_privilege('anon', '__SCHEMA__.push_due_rows(timestamptz)', 'execute'), 'anon due rows';
  assert not has_function_privilege('anon', '__SCHEMA__.push_any_due(timestamptz)', 'execute'), 'anon any due';
  assert has_function_privilege('service_role', '__SCHEMA__.push_claim_due(integer,timestamptz)', 'execute'), 'service claim';
  assert has_function_privilege('service_role', '__SCHEMA__.push_record(text,integer,timestamptz)', 'execute'), 'service record';
  assert not has_table_privilege('anon', '__SCHEMA__.push_subscriptions', 'select'), 'anon table';
  assert not has_table_privilege('anon', '__SCHEMA__.push_schedule', 'select'), 'anon schedule';
end $$;

rollback;
```

- [ ] **Step 4: Run the tests to see them fail**

Create an empty `supabase/push/core.sql` first (`: > supabase/push/core.sql`), then run:
`scripts/test-push-sql.sh`
Expected: FAIL with `relation "dev.push_schedule" does not exist`.

- [ ] **Step 5: Write `core.sql`**

`supabase/push/core.sql`:

```sql
-- Push reminders: tables, functions, grants. Plain Postgres (no pg_cron,
-- pg_net or Vault here; those are in cron.sql), so scripts/test-push-sql.sh can
-- run it locally. Idempotent: safe to apply again after an edit.
-- Spec: docs/superpowers/specs/2026-11-05-scheduled-push-reminder-design.md

-- When reminders go out. Edited by the owner in the Supabase Table Editor.
create table if not exists __SCHEMA__.push_schedule (
  id          bigint generated always as identity primary key,
  weekday     smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday, 7 = Sunday
  local_time  time     not null check (extract(second from local_time) = 0),
  enabled     boolean  not null default true,
  note        text,
  unique (weekday, local_time)
);
alter table __SCHEMA__.push_schedule enable row level security;

-- One row per browser that switched reminders on. Nothing about what the
-- visitor wants: that stays on the phone.
create table if not exists __SCHEMA__.push_subscriptions (
  endpoint       text primary key,
  p256dh         text not null,
  auth           text not null,
  tz             text not null default 'Europe/Warsaw',
  created_at     timestamptz not null default now(),
  last_slot_at   timestamptz,
  last_ok_at     timestamptz,
  failure_count  int not null default 0
);
alter table __SCHEMA__.push_subscriptions enable row level security;

revoke all on table __SCHEMA__.push_schedule, __SCHEMA__.push_subscriptions from anon, authenticated;

-- Devices with a slot to ring at p_at: a schedule row placed on the device's
-- local today or yesterday (so a 23:30 slot is caught up after midnight),
-- inside a 60-minute catch-up window, not already rung. The one definition of
-- "due" that push_any_due and push_claim_due both read.
create or replace function __SCHEMA__.push_due_rows(p_at timestamptz default now())
returns table (endpoint text, slot_at timestamptz)
language sql stable
set search_path = ''
as $$
  select s.endpoint, max(slot.slot_at)
  from __SCHEMA__.push_subscriptions s
  cross join lateral (
    select (d.day + sch.local_time) at time zone s.tz as slot_at
    from (values ((p_at at time zone s.tz)::date), ((p_at at time zone s.tz)::date - 1)) as d(day)
    join __SCHEMA__.push_schedule sch
      on sch.enabled and sch.weekday = extract(isodow from d.day)
  ) slot
  where slot.slot_at <= p_at
    and slot.slot_at > p_at - interval '60 minutes'
    and (s.last_slot_at is null or s.last_slot_at < slot.slot_at)
  group by s.endpoint
$$;

create or replace function __SCHEMA__.push_any_due(p_at timestamptz default now())
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from __SCHEMA__.push_due_rows(p_at))
$$;

-- Claims up to p_batch due devices by writing their slot into last_slot_at
-- BEFORE anything is sent: at most once per slot. The recheck in WHERE is
-- what makes a concurrent claim safe: FOR UPDATE re-evaluates it against a row
-- another transaction has just claimed, and drops it.
create or replace function __SCHEMA__.push_claim_due(p_batch int default 500, p_at timestamptz default now())
returns table (endpoint text, p256dh text, auth text)
language sql volatile security definer
set search_path = ''
as $$
  with locked as (
    select s.endpoint, due.slot_at
    from __SCHEMA__.push_due_rows(p_at) due
    join __SCHEMA__.push_subscriptions s on s.endpoint = due.endpoint
    where s.last_slot_at is null or s.last_slot_at < due.slot_at
    order by s.endpoint
    limit greatest(p_batch, 1)
    for update of s skip locked
  )
  update __SCHEMA__.push_subscriptions s
     set last_slot_at = locked.slot_at
    from locked
   where s.endpoint = locked.endpoint
  returning s.endpoint, s.p256dh, s.auth
$$;

-- One send result. 0 = network error (no HTTP status).
create or replace function __SCHEMA__.push_record(p_endpoint text, p_status int, p_at timestamptz default now())
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_status between 200 and 299 then
    update __SCHEMA__.push_subscriptions
       set last_ok_at = p_at, failure_count = 0
     where endpoint = p_endpoint;
  elsif p_status in (404, 410) then
    delete from __SCHEMA__.push_subscriptions where endpoint = p_endpoint;
  else
    update __SCHEMA__.push_subscriptions
       set failure_count = failure_count + 1
     where endpoint = p_endpoint;
    delete from __SCHEMA__.push_subscriptions
     where endpoint = p_endpoint
       and (failure_count >= 5 or coalesce(last_ok_at, created_at) < p_at - interval '60 days');
  end if;
end $$;

-- Called by the page with the anon key.
create or replace function __SCHEMA__.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_tz text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_host text;
  v_tz   text;
begin
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'push_subscribe: endpoint must be an https URL' using errcode = '22023';
  end if;
  v_host := lower(substring(p_endpoint from '^https://([^/:?#]+)'));
  if not (v_host = 'fcm.googleapis.com'
          or v_host = 'web.push.apple.com'
          or v_host like '%.push.services.mozilla.com'
          or v_host like '%.notify.windows.com') then
    raise exception 'push_subscribe: % is not a push service', v_host using errcode = '22023';
  end if;
  if length(coalesce(p_p256dh, '')) not between 1 and 200
     or length(coalesce(p_auth, '')) not between 1 and 200 then
    raise exception 'push_subscribe: bad keys' using errcode = '22023';
  end if;
  v_tz := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz)
               then p_tz else 'Europe/Warsaw' end;

  insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth, tz, last_slot_at)
  values (p_endpoint, p_p256dh, p_auth, v_tz, now())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz;
end $$;

create or replace function __SCHEMA__.push_unsubscribe(p_endpoint text)
returns void
language sql security definer
set search_path = ''
as $$
  delete from __SCHEMA__.push_subscriptions where endpoint = p_endpoint
$$;

-- Functions are executable by PUBLIC by default, and Supabase also grants
-- anon/authenticated by default privileges. Revoke all, then grant exactly.
revoke all on function __SCHEMA__.push_due_rows(timestamptz)              from public, anon, authenticated;
revoke all on function __SCHEMA__.push_any_due(timestamptz)               from public, anon, authenticated;
revoke all on function __SCHEMA__.push_claim_due(int, timestamptz)        from public, anon, authenticated;
revoke all on function __SCHEMA__.push_record(text, int, timestamptz)     from public, anon, authenticated;
revoke all on function __SCHEMA__.push_subscribe(text, text, text, text)  from public, anon, authenticated;
revoke all on function __SCHEMA__.push_unsubscribe(text)                  from public, anon, authenticated;

grant execute on function __SCHEMA__.push_subscribe(text, text, text, text) to anon, authenticated;
grant execute on function __SCHEMA__.push_unsubscribe(text)                 to anon, authenticated;
grant execute on function __SCHEMA__.push_claim_due(int, timestamptz)       to service_role;
grant execute on function __SCHEMA__.push_record(text, int, timestamptz)    to service_role;

-- PostgREST caches the schema; without this a new RPC answers 404 for a while.
notify pgrst, 'reload schema';
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `scripts/test-push-sql.sh`
Expected: `push SQL tests passed`. A failing `assert` prints its message, for example `ERROR:  Tue 12:00 Warsaw: Warsaw due`. When one fails, fix `core.sql` and re-run. Never change the test to make it pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/push-sql.sh scripts/test-push-sql.sh supabase/push/core.sql supabase/push/tests.sql
git commit -m "feat(push): schedule and subscription tables with due/claim/record functions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Seed and cron SQL (Supabase-only pieces)

**Files:**
- Create: `supabase/push/seed.sql`
- Create: `supabase/push/cron.sql`

These cannot run locally, because pg_cron, pg_net and Vault exist only in Supabase. Task 20 applies them and checks them there.

- [ ] **Step 1: Write the seed**

`supabase/push/seed.sql`:

```sql
-- The starting schedule: Sunday, Tuesday and Thursday at 12:00, in each
-- visitor's own timezone. After this, the owner edits the table directly.
insert into __SCHEMA__.push_schedule (weekday, local_time, note) values
  (7, '12:00', 'niedziela'),
  (2, '12:00', 'wtorek'),
  (4, '12:00', 'czwartek')
on conflict (weekday, local_time) do nothing;
```

- [ ] **Step 2: Write the cron piece**

`supabase/push/cron.sql`:

```sql
-- Supabase only: needs pg_cron, pg_net and Vault (all installed in the hub
-- project). Apply AFTER core.sql, and only once the two Vault secrets exist:
--   push_send_url    = https://<project-ref>.supabase.co/functions/v1/push-send
--   push_cron_secret = the same value as the Edge Function secret PUSH_CRON_SECRET

-- Every minute: one cheap query. Only when somebody is due does it call the
-- Edge Function, which claims, sends and records. Overlapping calls are safe:
-- push_claim_due hands each device to exactly one of them.
create or replace function __SCHEMA__.push_tick()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not __SCHEMA__.push_any_due() then
    return;
  end if;
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_send_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'push_tick: Vault secrets push_send_url / push_cron_secret are missing';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('schema', '__SCHEMA__'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 120000
  );
end $$;

revoke all on function __SCHEMA__.push_tick() from public, anon, authenticated;

-- cron.schedule with an existing name updates that job, so this is re-runnable.
select cron.schedule('push-tick-__SCHEMA__', '* * * * *', $$select __SCHEMA__.push_tick()$$);
```

- [ ] **Step 3: Check the rendering**

Run: `scripts/push-sql.sh dev supabase/push/cron.sql | grep -c __SCHEMA__`
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/push/seed.sql supabase/push/cron.sql
git commit -m "feat(push): seed schedule and the per-minute pg_cron tick

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Edge Function handler (pure) with Deno tests

**Files:**
- Create: `supabase/functions/push-send/handler.test.ts`
- Create: `supabase/functions/push-send/handler.ts`

- [ ] **Step 1: Write the failing tests**

`supabase/functions/push-send/handler.test.ts`:

```ts
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
    claim: async () => (calls++ === 0 ? [sub(1), sub(2), sub(3)] : []),
    record: async (schema, endpoint, status) => {
      recorded.push([schema, endpoint, status]);
    },
    send: async () => 201,
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
  const d = deps({ send: async () => statuses[i++] });
  const res = await handle(post({ schema: 'dev' }), d);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { claimed: 3, sent: 1, gone: 1, failed: 1, recordFailed: 0 });
  assertEquals(d.recorded.map((r) => r[2]).sort(), [201, 410, 503]);
  assert(d.recorded.every((r) => r[0] === 'dev'));
});

Deno.test('a sender that throws is recorded as status 0', async () => {
  const d = deps({ send: async () => { throw new Error('reset'); } });
  await handle(post({ schema: 'public' }), d);
  assert(d.recorded.every((r) => r[2] === 0));
});

Deno.test('keeps claiming while a batch comes back full', async () => {
  let call = 0;
  const d = deps({
    claim: async () => {
      call++;
      if (call === 1) return Array.from({ length: BATCH }, (_, n) => sub(n));
      if (call === 2) return [sub(9999)];
      return [];
    },
  });
  const res = await handle(post({ schema: 'dev' }), d);
  assertEquals((await res.json()).claimed, BATCH + 1);
  assertEquals(call, 2);
});

Deno.test('a failed record is counted, not fatal', async () => {
  const d = deps({ record: async () => { throw new Error('db'); } });
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `deno test supabase/functions/push-send/handler.test.ts`
Expected: FAIL with `Module not found ".../handler.ts"`.

- [ ] **Step 3: Write the handler**

`supabase/functions/push-send/handler.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `deno test supabase/functions/push-send/handler.test.ts`
Expected: `ok | 11 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/push-send/handler.ts supabase/functions/push-send/handler.test.ts
git commit -m "feat(push): push-send handler (auth, claim/send/record loop, payload)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The sender and the function entry point

**Files:**
- Create: `supabase/functions/push-send/sender.ts`
- Create: `supabase/functions/push-send/index.ts`

- [ ] **Step 1: Write the web-push adapter**

`supabase/functions/push-send/sender.ts`:

```ts
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
```

- [ ] **Step 2: Write the entry point**

`supabase/functions/push-send/index.ts`:

```ts
// push-send: called by pg_cron (via pg_net) when a device is due.
// Deployed with JWT verification OFF. The x-push-secret header is the auth.
// Secrets: PUSH_CRON_SECRET, VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// SITE_URL_PUBLIC, SITE_URL_DEV. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by the platform.
// deno-lint-ignore-file no-explicit-any
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
    secret: need('PUSH_CRON_SECRET'),
    siteUrls: { public: need('SITE_URL_PUBLIC'), dev: need('SITE_URL_DEV') },
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
```

- [ ] **Step 3: Type-check under Deno**

Run: `deno check supabase/functions/push-send/index.ts`
Expected: no errors. The first run downloads `npm:web-push` and `npm:@supabase/supabase-js`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-send/sender.ts supabase/functions/push-send/index.ts
git commit -m "feat(push): web-push sender and push-send entry point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Spike: a real push to desktop Chrome through the Deno sender

This tests the spec's phase-0 risk: does `npm:web-push` encrypt correctly under Deno? Answering that needs a real browser. Localhost counts as a secure context, so no deploy is needed.

**Files:**
- Create: `scripts/push-spike/index.html`
- Create: `scripts/push-spike/sw.js`
- Create: `scripts/push-spike/send.ts`

- [ ] **Step 1: Generate VAPID keys into a private file, never the terminal**

```bash
mkdir -p ~/.config/idznamiasto && chmod 700 ~/.config/idznamiasto
npx --yes web-push generate-vapid-keys --json > ~/.config/idznamiasto/vapid.json
chmod 600 ~/.config/idznamiasto/vapid.json
node -e '
const k = require(process.env.HOME + "/.config/idznamiasto/vapid.json");
require("fs").writeFileSync(process.env.HOME + "/.config/idznamiasto/vapid.env",
  `VAPID_SUBJECT=mailto:adud3k93@gmail.com\nVAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\n`,
  { mode: 0o600 });'
```

Expected: no output. These keys serve every environment. The public key is not secret, since it ships in the page; the private key is.

- [ ] **Step 2: Write the spike page**

`scripts/push-spike/index.html`:

```html
<!doctype html>
<meta charset="utf-8" />
<title>push spike</title>
<p>Manual tool: subscribe this browser, then run scripts/push-spike/send.ts.</p>
<label>VAPID public key <input id="key" size="100" /></label>
<button id="go">Subscribe</button>
<p><textarea id="out" rows="8" cols="100" readonly></textarea></p>
<script>
  function b64(s) {
    const p = '='.repeat((4 - (s.length % 4)) % 4);
    const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  document.getElementById('go').onclick = async () => {
    if ((await Notification.requestPermission()) !== 'granted') return alert('permission refused');
    await navigator.serviceWorker.register('sw.js');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64(document.getElementById('key').value.trim()),
    });
    document.getElementById('out').value = JSON.stringify(sub.toJSON());
  };
</script>
```

`scripts/push-spike/sw.js`:

```js
// Shows whatever arrives, so the spike tests only delivery and encryption.
self.addEventListener('push', (event) => {
  let n = { title: 'push spike', body: '(no payload)' };
  try {
    n = event.data.json().notification;
  } catch {}
  event.waitUntil(self.registration.showNotification(n.title, { body: n.body }));
});
```

`scripts/push-spike/send.ts`:

```ts
// Usage: deno run --allow-net --allow-read --allow-env \
//   --env-file=$HOME/.config/idznamiasto/vapid.env scripts/push-spike/send.ts <subscription.json>
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
```

- [ ] **Step 3: Subscribe desktop Chrome**

```bash
npx --yes serve scripts/push-spike -l 8787
```

1. Open `http://localhost:8787` in desktop Chrome.
2. Paste the public key into the field. It is the `VAPID_PUBLIC_KEY` line of `~/.config/idznamiasto/vapid.env`, and the owner opens that file in an editor. The key itself is public, but do not print the env file: it also holds the private key.
3. Click Subscribe and allow notifications.
4. Copy the textarea contents into `/private/tmp/push-sub.json`.

- [ ] **Step 4: Send**

```bash
deno run --allow-net --allow-read --allow-env \
  --env-file=$HOME/.config/idznamiasto/vapid.env \
  scripts/push-spike/send.ts /private/tmp/push-sub.json
```

Expected: `push service answered 201`, and a notification "Idź na miasto / Zobacz, jakie są nowe wydarzenia w Twojej okolicy" appears.

- [ ] **Step 5: Gate**

- **201, and the notification appeared:** go to step 7.
- **Anything else** (an exception from inside `web-push`, or a 4xx such as `400 UnauthorizedRegistration`): go to step 6.

- [ ] **Step 6 (only if step 5 failed): Switch to the Deno-native library**

Replace `supabase/functions/push-send/sender.ts` with the version below.

1. **Check the API first** against the README at `https://jsr.io/@negrel/webpush` (use context7 or WebFetch). The names below are from version 0.5; where they differ from the README, the README wins.
2. **VAPID keys change format.** This library needs VAPID keys as a JWK pair, generated by its own script. So the `.env` gets `VAPID_KEYS_JWK` instead of the two separate keys.
3. **Update the callers.** Adjust the `need(...)` calls in `index.ts` and the secret list in Task 20 to match.

```ts
import * as webpush from 'jsr:@negrel/webpush@0.5';
import type { Subscription } from './handler.ts';

export const TTL_SECONDS = 21600;

export async function makeWebPushSender(vapid: { subject: string; keysJwk: string }) {
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapid.keysJwk), { extractable: false });
  const server = await webpush.ApplicationServer.new({ contactInformation: vapid.subject, vapidKeys });
  return async (sub: Subscription, payload: string): Promise<number> => {
    try {
      await server
        .subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
        .pushTextMessage(payload, { ttl: TTL_SECONDS, urgency: webpush.Urgency.High });
      return 201;
    } catch (err) {
      const status = (err as { response?: { status?: unknown } }).response?.status;
      return typeof status === 'number' ? status : 0;
    }
  };
}
```

Re-run steps 3-5. If this also fails, stop and report to the owner: the fallback is a GitHub Actions sender (spec, decision 12), and that changes Tasks 4 and 20.

- [ ] **Step 7: Commit**

```bash
git add scripts/push-spike supabase/functions/push-send/sender.ts
git commit -m "chore(push): local spike that sends a real push through the Deno sender

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Feature flags

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/config/site.ts`
- Create: `src/config/site.spec.ts`

- [ ] **Step 1: Write the failing test**

`src/config/site.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadSite() {
  vi.resetModules();
  return import('./site');
}

describe('IS_PUSH_ENABLED', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUSH_ENABLED', '');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BKey');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(false);
  });

  it('needs the exact string true AND a VAPID key', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUSH_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BKey');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(true);
  });

  it('treats a typo as off', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUSH_ENABLED', 'ture');
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BKey');
    expect((await loadSite()).IS_PUSH_ENABLED).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/config/site.spec.ts`
Expected: FAIL, because `IS_PUSH_ENABLED` is `undefined`.

- [ ] **Step 3: Add the env vars**

In `src/config/env.ts`, add to `envSchema` after `NEXT_PUBLIC_ONBOARDING_ENABLED`:

```ts
  // Push reminders. Off unless this is the exact string 'true' — the opposite
  // of onboarding's default on purpose: a half-configured push (no VAPID key,
  // no table) must fail as "the card is not there", never as a switch that
  // errors. See docs/superpowers/specs/2026-11-05-scheduled-push-reminder-design.md
  NEXT_PUBLIC_PUSH_ENABLED: z.string().default(''),
  // Public half of the VAPID key pair (the private half is an Edge Function
  // secret). Not a secret: it ships in the page.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().default(''),
```

and to the object in `validateEnv`:

```ts
    NEXT_PUBLIC_PUSH_ENABLED: process.env.NEXT_PUBLIC_PUSH_ENABLED,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
```

- [ ] **Step 4: Add the flag**

In `src/config/site.ts`, after `IS_ONBOARDING_ENABLED`:

```ts
// Whether push reminders ship. Needs the exact string 'true' AND a VAPID public
// key: without the key no browser can subscribe, so a set flag alone would show
// a switch that can only fail.
export const IS_PUSH_ENABLED =
  env.NEXT_PUBLIC_PUSH_ENABLED === 'true' && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== '';
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm vitest run src/config/site.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/config/env.ts src/config/site.ts src/config/site.spec.ts
git commit -m "feat(push): NEXT_PUBLIC_PUSH_ENABLED and VAPID public key, off by default

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `pushSupport`, the platform check

**Files:**
- Create: `src/lib/pushSupport.spec.ts`
- Create: `src/lib/pushSupport.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/pushSupport.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pushSupport } from './pushSupport';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

interface Opts {
  ua?: string;
  platform?: string;
  touch?: number;
  standalone?: boolean;
  displayStandalone?: boolean;
  api?: boolean;
  permission?: NotificationPermission;
}

function env(o: Opts = {}) {
  const nav: Record<string, unknown> = {
    userAgent: o.ua ?? ANDROID,
    platform: o.platform ?? 'Linux armv8l',
    maxTouchPoints: o.touch ?? 5,
  };
  if (o.standalone !== undefined) nav.standalone = o.standalone;
  if (o.api !== false) nav.serviceWorker = {};
  const win: Record<string, unknown> = {
    matchMedia: (q: string) => ({ matches: q === '(display-mode: standalone)' && Boolean(o.displayStandalone) }),
  };
  if (o.api !== false) {
    win.PushManager = function PushManager() {};
    win.Notification = { permission: o.permission ?? 'default' };
  }
  return [nav as unknown as Navigator, win as unknown as Window] as const;
}

describe('pushSupport', () => {
  it('ready on Android Chrome', () => {
    expect(pushSupport(...env())).toBe('ready');
  });

  it('blocked when permission was denied', () => {
    expect(pushSupport(...env({ permission: 'denied' }))).toBe('blocked');
  });

  it('unsupported without the APIs', () => {
    expect(pushSupport(...env({ api: false }))).toBe('unsupported');
  });

  it('iPhone in Safari has to install first', () => {
    expect(pushSupport(...env({ ua: IPHONE, platform: 'iPhone', api: false }))).toBe('ios-install-first');
  });

  it('iPhone from the Home Screen is ready (navigator.standalone)', () => {
    expect(pushSupport(...env({ ua: IPHONE, platform: 'iPhone', standalone: true }))).toBe('ready');
  });

  it('iPhone from the Home Screen is ready (display-mode media query)', () => {
    expect(pushSupport(...env({ ua: IPHONE, platform: 'iPhone', displayStandalone: true }))).toBe('ready');
  });

  it('iPad that reports itself as a Mac still has to install first', () => {
    expect(pushSupport(...env({ ua: MAC, platform: 'MacIntel', touch: 5, api: false }))).toBe('ios-install-first');
  });

  it('a real Mac with Safari is ready', () => {
    expect(pushSupport(...env({ ua: MAC, platform: 'MacIntel', touch: 0 }))).toBe('ready');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/lib/pushSupport.spec.ts`
Expected: FAIL, `Cannot find module './pushSupport'`.

- [ ] **Step 3: Implement**

`src/lib/pushSupport.ts`:

```ts
// Which of four states the visitor's browser is in for push reminders. Pure:
// navigator and window are passed in, so every branch has a unit test.
export type PushSupport = 'ready' | 'ios-install-first' | 'blocked' | 'unsupported';

function isIos(nav: Navigator): boolean {
  // iPadOS Safari reports itself as a Mac; a touch screen gives it away.
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

function isStandalone(nav: Navigator, win: Window): boolean {
  return (
    (nav as Navigator & { standalone?: boolean }).standalone === true ||
    win.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export function pushSupport(nav: Navigator, win: Window): PushSupport {
  // iOS delivers web push only to Home Screen web apps. Checked before the
  // APIs, because Safari in a tab does not expose PushManager at all.
  if (isIos(nav) && !isStandalone(nav, win)) return 'ios-install-first';
  const w = win as Window & { PushManager?: unknown; Notification?: { permission: NotificationPermission } };
  if (!('serviceWorker' in nav) || !w.PushManager || !w.Notification) return 'unsupported';
  if (w.Notification.permission === 'denied') return 'blocked';
  return 'ready';
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm vitest run src/lib/pushSupport.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pushSupport.ts src/lib/pushSupport.spec.ts
git commit -m "feat(push): pushSupport platform check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The IndexedDB record shared with the worker

**Files:**
- Modify: `package.json` (dev dependency)
- Create: `src/lib/pushSettingsStore.spec.ts`
- Create: `src/lib/pushSettingsStore.ts`

- [ ] **Step 1: Add the test-only IndexedDB**

Run: `pnpm add -D fake-indexeddb@^6`
Expected: `package.json` and `pnpm-lock.yaml` change.

- [ ] **Step 2: Write the failing tests**

`src/lib/pushSettingsStore.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PUSH_DB,
  PUSH_SETTINGS_KEY,
  PUSH_STORE,
  clearPushSettings,
  readPushSettings,
  writePushSettings,
} from './pushSettingsStore';

describe('pushSettingsStore', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('reads null when nothing was written', async () => {
    expect(await readPushSettings()).toBeNull();
  });

  it('round-trips a record', async () => {
    const settings = { locale: 'pl' as const, preset: { id: 'p1', name: 'Taniec' } };
    await writePushSettings(settings);
    expect(await readPushSettings()).toEqual(settings);
  });

  it('clears the record', async () => {
    await writePushSettings({ locale: 'en', preset: null });
    await clearPushSettings();
    expect(await readPushSettings()).toBeNull();
  });

  it('ignores a record of the wrong shape', async () => {
    await writePushSettings({ locale: 'pl', preset: null });
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open(PUSH_DB, 1);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction(PUSH_STORE, 'readwrite');
      tx.objectStore(PUSH_STORE).put({ locale: 'de', preset: 7 }, PUSH_SETTINGS_KEY);
      tx.oncomplete = () => resolve();
    });
    db.close();
    expect(await readPushSettings()).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm vitest run src/lib/pushSettingsStore.spec.ts`
Expected: FAIL, `Cannot find module './pushSettingsStore'`.

- [ ] **Step 4: Implement**

`src/lib/pushSettingsStore.ts`:

```ts
// The one record the push service worker reads. A service worker cannot read
// localStorage, so the page mirrors exactly what a reminder needs here.
// public/push-sw.js hard-codes the same three names; src/lib/pushSw.spec.ts
// writes through THIS module and reads through the worker, which is what
// keeps them in step.

export const PUSH_DB = 'idznamiasto-push';
export const PUSH_STORE = 'kv';
export const PUSH_SETTINGS_KEY = 'settings';

export interface PushSettings {
  locale: 'pl' | 'en';
  /** The marked filter: at most one. Null = the reminder opens the home page. */
  preset: { id: string; name: string } | null;
}

export function isPushSettings(value: unknown): value is PushSettings {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.locale !== 'pl' && v.locale !== 'en') return false;
  if (v.preset === null) return true;
  if (!v.preset || typeof v.preset !== 'object') return false;
  const p = v.preset as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PUSH_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(PUSH_STORE, mode);
      const req = op(tx.objectStore(PUSH_STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readPushSettings(): Promise<PushSettings | null> {
  const value = await run('readonly', (store) => store.get(PUSH_SETTINGS_KEY));
  return isPushSettings(value) ? value : null;
}

export async function writePushSettings(settings: PushSettings): Promise<void> {
  await run('readwrite', (store) => store.put(settings, PUSH_SETTINGS_KEY));
}

export async function clearPushSettings(): Promise<void> {
  await run('readwrite', (store) => store.delete(PUSH_SETTINGS_KEY));
}
```

- [ ] **Step 5: Run them to see them pass**

Run: `pnpm vitest run src/lib/pushSettingsStore.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/pushSettingsStore.ts src/lib/pushSettingsStore.spec.ts
git commit -m "feat(push): IndexedDB record shared by the page and the worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The service worker

**Files:**
- Create: `src/lib/pushSw.spec.ts`
- Create: `public/push-sw.js`
- Modify: `public/sw.js` (comment only)

- [ ] **Step 1: Write the failing tests**

`src/lib/pushSw.spec.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writePushSettings } from './pushSettingsStore';

// public/push-sw.js is a plain script with no build step. Running its source in
// a fresh vm context with a fake `self` tests the file that actually ships.
const SOURCE = readFileSync(path.resolve(__dirname, '../../public/push-sw.js'), 'utf8');

type Listener = (event: unknown) => void;

function boot(scope = 'https://idznamiasto.pl/', idb: unknown = globalThis.indexedDB) {
  const listeners: Record<string, Listener> = {};
  const self = {
    indexedDB: idb,
    registration: { scope, showNotification: vi.fn(async () => undefined) },
    clients: {
      matchAll: vi.fn(async () => [] as unknown[]),
      openWindow: vi.fn(async () => null),
      claim: vi.fn(async () => undefined),
    },
    caches: { keys: vi.fn(async () => ['workbox-precache-v2']), delete: vi.fn(async () => true) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
  };
  vm.runInNewContext(SOURCE, { self }, { filename: 'push-sw.js' });
  return { self, listeners };
}

async function fire(listener: Listener, event: Record<string, unknown>) {
  const pending: Promise<unknown>[] = [];
  listener({ ...event, waitUntil: (p: Promise<unknown>) => pending.push(p) });
  await Promise.all(pending);
}

const PAYLOAD = {
  web_push: 8030,
  notification: {
    title: 'Idź na miasto',
    body: 'Zobacz, jakie są nowe wydarzenia w Twojej okolicy',
    navigate: 'https://idznamiasto.pl/?src=push',
  },
  mutable: true,
};
const pushEvent = (payload: unknown = PAYLOAD) => ({ data: { json: () => payload } });

describe('push-sw.js', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('with no record shows the payload as received', async () => {
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({
        body: 'Zobacz, jakie są nowe wydarzenia w Twojej okolicy',
        tag: 'reminder',
        data: { url: 'https://idznamiasto.pl/?src=push' },
      })
    );
  });

  it('with no marked filter opens the home page', async () => {
    await writePushSettings({ locale: 'pl', preset: null });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({ data: { url: 'https://idznamiasto.pl/?src=push' } })
    );
  });

  it('with a marked filter names it and opens it', async () => {
    await writePushSettings({ locale: 'pl', preset: { id: 'p 1', name: 'Taniec w weekend' } });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Taniec w weekend',
      expect.objectContaining({
        body: 'Zobacz, co nowego pasuje do tego filtra',
        data: { url: 'https://idznamiasto.pl/moje-filtry/?open=p%201&src=push' },
      })
    );
  });

  it('speaks English when the page was in English', async () => {
    await writePushSettings({ locale: 'en', preset: null });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({ body: 'See what is new near you' })
    );
  });

  it('builds links under the base path of the dev site', async () => {
    await writePushSettings({ locale: 'pl', preset: { id: 'p1', name: 'X' } });
    const { self, listeners } = boot('https://aleksanderdudek.github.io/your-events/');
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'X',
      expect.objectContaining({
        data: { url: 'https://aleksanderdudek.github.io/your-events/moje-filtry/?open=p1&src=push' },
      })
    );
  });

  it('cuts a long filter name to 60 characters', async () => {
    await writePushSettings({ locale: 'pl', preset: { id: 'p1', name: 'a'.repeat(80) } });
    const { self, listeners } = boot();
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledWith('a'.repeat(60), expect.anything());
  });

  it('still shows something when the payload cannot be parsed', async () => {
    const { self, listeners } = boot();
    await fire(listeners.push, { data: { json: () => { throw new Error('bad'); } } });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Idź na miasto',
      expect.objectContaining({ data: { url: 'https://idznamiasto.pl/?src=push' } })
    );
  });

  it('still shows something when IndexedDB throws', async () => {
    const broken = { open: () => { throw new Error('blocked'); } };
    const { self, listeners } = boot('https://idznamiasto.pl/', broken);
    await fire(listeners.push, pushEvent());
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
  });

  it('a click focuses and navigates an open tab of the site', async () => {
    const { self, listeners } = boot();
    const tab = { url: 'https://idznamiasto.pl/szczecin/wydarzenia/', focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) };
    self.clients.matchAll.mockResolvedValue([tab]);
    const close = vi.fn();
    await fire(listeners.notificationclick, { notification: { close, data: { url: 'https://idznamiasto.pl/?src=push' } } });
    expect(close).toHaveBeenCalled();
    expect(tab.focus).toHaveBeenCalled();
    expect(tab.navigate).toHaveBeenCalledWith('https://idznamiasto.pl/?src=push');
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('a click opens a window when no tab is open, or navigate fails', async () => {
    const { self, listeners } = boot();
    const tab = { url: 'https://idznamiasto.pl/', focus: vi.fn(async () => undefined), navigate: vi.fn(async () => { throw new TypeError('uncontrolled'); }) };
    self.clients.matchAll.mockResolvedValue([tab]);
    await fire(listeners.notificationclick, { notification: { close: vi.fn(), data: { url: 'https://idznamiasto.pl/?src=push' } } });
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://idznamiasto.pl/?src=push');
  });

  it('activate clears the old PWA caches and takes control of open tabs', async () => {
    const { self, listeners } = boot();
    await fire(listeners.activate, {});
    expect(self.caches.delete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(self.clients.claim).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/lib/pushSw.spec.ts`
Expected: FAIL with `ENOENT: no such file or directory ... public/push-sw.js`.

- [ ] **Step 3: Write the worker**

`public/push-sw.js`:

```js
// Push reminders. Spec: docs/superpowers/specs/2026-11-05-scheduled-push-reminder-design.md
//
// Every device gets the same Declarative Web Push payload. This worker rewrites
// it from one IndexedDB record the page keeps: the locale, and the one filter
// the visitor marked with a bell. It fetches nothing and caches nothing.
// Every path ends in exactly one showNotification: Chrome shows its own "site
// updated in the background" otherwise, and Safari revokes the subscription
// after a few silent pushes.
//
// The three IndexedDB names must match src/lib/pushSettingsStore.ts.
// src/lib/pushSw.spec.ts runs this file with a fake `self`, so use `self.`
// for every worker global.

const DB = 'idznamiasto-push';
const STORE = 'kv';
const KEY = 'settings';
const NAME_MAX = 60;

const TEXT = {
  pl: {
    title: 'Idź na miasto',
    body: 'Zobacz, jakie są nowe wydarzenia w Twojej okolicy',
    filterBody: 'Zobacz, co nowego pasuje do tego filtra',
  },
  en: {
    title: 'Idź na miasto',
    body: 'See what is new near you',
    filterBody: 'See what is new for this filter',
  },
};

function base() {
  return self.registration.scope.replace(/\/+$/, '');
}

function readSettings() {
  return new Promise((resolve) => {
    let req;
    try {
      req = self.indexedDB.open(DB, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const get = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        get.onsuccess = () => {
          db.close();
          resolve(get.result ?? null);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

function compose(payload, settings) {
  const home = `${base()}/?src=push`;
  const sent = (payload && payload.notification) || {};
  if (!settings) {
    return { title: sent.title || TEXT.pl.title, body: sent.body || TEXT.pl.body, url: sent.navigate || home };
  }
  const text = TEXT[settings.locale] || TEXT.pl;
  if (settings.preset && settings.preset.id) {
    return {
      title: String(settings.preset.name || '').slice(0, NAME_MAX) || text.title,
      body: text.filterBody,
      url: `${base()}/moje-filtry/?open=${encodeURIComponent(settings.preset.id)}&src=push`,
    };
  }
  return { title: text.title, body: text.body, url: home };
}

async function onPush(event) {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  const settings = await readSettings().catch(() => null);
  const n = compose(payload, settings);
  await self.registration.showNotification(n.title, {
    body: n.body,
    icon: `${base()}/favicons/web-app-manifest-192x192.png`,
    tag: 'reminder',
    data: { url: n.url },
  });
}

async function openUrl(url) {
  const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const tab of tabs) {
    if (!tab.url.startsWith(self.registration.scope)) continue;
    try {
      await tab.focus();
      await tab.navigate(url);
      return;
    } catch {
      // An uncontrolled tab cannot be navigated from here: open a new one.
      break;
    }
  }
  await self.clients.openWindow(url);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Caches left by the retired Vite PWA worker (see public/sw.js). This
      // worker makes none of its own.
      const names = await self.caches.keys();
      await Promise.all(names.map((name) => self.caches.delete(name)));
      // Control open tabs so a notification click can navigate them.
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(onPush(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(openUrl(url));
});
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run src/lib/pushSw.spec.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Correct the retire worker's comment**

In `public/sw.js`, replace the paragraph

```js
// Nothing in the app registers a service worker, so a browser that never had
// the old one never runs this. It can be deleted once old visits have aged out
// (a few weeks is plenty for the dev site).
```

with

```js
// The app registers only public/push-sw.js (push reminders), at the same scope.
// Registering it replaces this script in that registration, so a browser runs
// this file only if it still had the old Vite worker. It can be deleted once
// old visits have aged out (a few weeks is plenty for the dev site).
```

- [ ] **Step 6: Commit**

```bash
git add public/push-sw.js public/sw.js src/lib/pushSw.spec.ts
git commit -m "feat(push): service worker that rewrites the reminder from the phone's record

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Pure mark and open rules

**Files:**
- Create: `src/lib/pushMark.spec.ts`
- Create: `src/lib/pushMark.ts`
- Create: `src/lib/pushOpen.spec.ts`
- Create: `src/lib/pushOpen.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/pushMark.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { markPreset, reconcileMark } from './pushMark';
import type { FilterPreset } from '@/types/preset.types';

const p = (id: string, name: string) => ({ id, name }) as FilterPreset;

describe('markPreset', () => {
  it('marks one filter, replacing any other', () => {
    const marked = markPreset({ locale: 'pl', preset: { id: 'a', name: 'A' } }, p('b', 'B'));
    expect(marked).toEqual({ locale: 'pl', preset: { id: 'b', name: 'B' } });
  });

  it('unmarks', () => {
    expect(markPreset({ locale: 'en', preset: { id: 'a', name: 'A' } }, null)).toEqual({ locale: 'en', preset: null });
  });

  it('stores at most 60 characters of the name', () => {
    expect(markPreset({ locale: 'pl', preset: null }, p('a', 'x'.repeat(90))).preset?.name).toHaveLength(60);
  });
});

describe('reconcileMark', () => {
  it('returns the same object when nothing changed', () => {
    const s = { locale: 'pl' as const, preset: { id: 'a', name: 'A' } };
    expect(reconcileMark(s, [p('a', 'A')])).toBe(s);
  });

  it('follows a rename', () => {
    const s = { locale: 'pl' as const, preset: { id: 'a', name: 'A' } };
    expect(reconcileMark(s, [p('a', 'Nowa')])).toEqual({ locale: 'pl', preset: { id: 'a', name: 'Nowa' } });
  });

  it('drops the mark when the filter was deleted', () => {
    const s = { locale: 'pl' as const, preset: { id: 'a', name: 'A' } };
    expect(reconcileMark(s, [p('b', 'B')])).toEqual({ locale: 'pl', preset: null });
  });

  it('leaves an unmarked record alone', () => {
    const s = { locale: 'pl' as const, preset: null };
    expect(reconcileMark(s, [])).toBe(s);
  });
});
```

`src/lib/pushOpen.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { presetToOpen, stripPushSource } from './pushOpen';
import type { FilterPreset } from '@/types/preset.types';

describe('stripPushSource', () => {
  it('returns null when the visit did not come from a push', () => {
    expect(stripPushSource('https://idznamiasto.pl/?a=1')).toBeNull();
  });

  it('removes src=push and keeps everything else', () => {
    expect(stripPushSource('https://idznamiasto.pl/moje-filtry/?open=p1&src=push')).toBe(
      'https://idznamiasto.pl/moje-filtry/?open=p1'
    );
  });
});

describe('presetToOpen', () => {
  const presets = [{ id: 'p1' }, { id: 'p2' }] as FilterPreset[];

  it('finds the filter named by ?open=', () => {
    expect(presetToOpen('?open=p2&src=push', presets)?.id).toBe('p2');
  });

  it('returns null for no ?open= or an unknown id', () => {
    expect(presetToOpen('', presets)).toBeNull();
    expect(presetToOpen('?open=gone', presets)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/lib/pushMark.spec.ts src/lib/pushOpen.spec.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/pushMark.ts`:

```ts
import type { FilterPreset } from '@/types/preset.types';
import type { PushSettings } from '@/lib/pushSettingsStore';

// Same cut as the worker's NAME_MAX: a lock screen shows about this much.
export const PUSH_NAME_MAX = 60;

/** Marks `preset` (replacing any other mark), or unmarks with null. */
export function markPreset(settings: PushSettings, preset: Pick<FilterPreset, 'id' | 'name'> | null): PushSettings {
  return {
    ...settings,
    preset: preset ? { id: preset.id, name: preset.name.slice(0, PUSH_NAME_MAX) } : null,
  };
}

/**
 * Keeps the stored mark in step with the saved filters: a renamed filter
 * carries its new name into the next reminder, a deleted one stops being
 * the reminder's target. Returns the SAME object when nothing changed, so a
 * caller can skip the write.
 */
export function reconcileMark(settings: PushSettings, presets: readonly FilterPreset[]): PushSettings {
  const marked = settings.preset;
  if (!marked) return settings;
  const current = presets.find((p) => p.id === marked.id);
  if (!current) return { ...settings, preset: null };
  const name = current.name.slice(0, PUSH_NAME_MAX);
  return name === marked.name ? settings : { ...settings, preset: { id: marked.id, name } };
}
```

`src/lib/pushOpen.ts`:

```ts
import type { FilterPreset } from '@/types/preset.types';

/**
 * The URL without `src=push`, or null when the visit did not come from a
 * reminder. Stripped after counting so a shared link does not count again.
 */
export function stripPushSource(href: string): string | null {
  const url = new URL(href);
  if (url.searchParams.get('src') !== 'push') return null;
  url.searchParams.delete('src');
  return url.toString();
}

/** The saved filter a reminder asked to open (`?open=<id>`), if it still exists. */
export function presetToOpen(search: string, presets: readonly FilterPreset[]): FilterPreset | null {
  const id = new URLSearchParams(search).get('open');
  if (!id) return null;
  return presets.find((p) => p.id === id) ?? null;
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm vitest run src/lib/pushMark.spec.ts src/lib/pushOpen.spec.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pushMark.ts src/lib/pushMark.spec.ts src/lib/pushOpen.ts src/lib/pushOpen.spec.ts
git commit -m "feat(push): pure rules for the marked filter and reminder links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `pushClient`, the browser plumbing

**Files:**
- Create: `src/lib/pushClient.spec.ts`
- Create: `src/lib/pushClient.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/pushClient.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ getSupabaseForCity: () => ({ rpc }) }));
vi.mock('@/config/env', () => ({ env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'AQID' } }));
vi.mock('@/lib/constants', () => ({ withBasePath: (p: string) => `/your-events${p}` }));

import {
  deviceTimeZone,
  subscribeDevice,
  unsubscribeDevice,
  urlBase64ToUint8Array,
} from './pushClient';

function fakeSubscription(endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function installBrowser(opts: { permission?: NotificationPermission; existing?: ReturnType<typeof fakeSubscription> | null } = {}) {
  const created = fakeSubscription();
  const pushManager = {
    getSubscription: vi.fn(async () => opts.existing ?? null),
    subscribe: vi.fn(async () => created),
  };
  const reg = { pushManager };
  const serviceWorker = {
    register: vi.fn(async () => reg),
    getRegistration: vi.fn(async () => reg),
    ready: Promise.resolve(reg),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
  vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => opts.permission ?? 'granted') });
  return { serviceWorker, pushManager, created };
}

describe('pushClient', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('decodes a base64url VAPID key', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });

  it('reads the device timezone, with Warsaw as the fallback', () => {
    expect(typeof deviceTimeZone()).toBe('string');
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl');
    });
    expect(deviceTimeZone()).toBe('Europe/Warsaw');
    spy.mockRestore();
  });

  it('returns denied without touching the service worker', async () => {
    const { serviceWorker } = installBrowser({ permission: 'denied' });
    expect(await subscribeDevice()).toBe('denied');
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('registers under the base path, subscribes and sends the subscription with the timezone', async () => {
    const { serviceWorker, pushManager } = installBrowser();
    expect(await subscribeDevice()).toBe('enabled');
    expect(serviceWorker.register).toHaveBeenCalledWith('/your-events/push-sw.js', { scope: '/your-events/' });
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(rpc).toHaveBeenCalledWith('push_subscribe', {
      p_endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p_p256dh: 'P',
      p_auth: 'A',
      p_tz: deviceTimeZone(),
    });
  });

  it('reuses an existing subscription', async () => {
    const existing = fakeSubscription('https://fcm.googleapis.com/fcm/send/old');
    const { pushManager } = installBrowser({ existing });
    expect(await subscribeDevice()).toBe('enabled');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('push_subscribe', expect.objectContaining({ p_endpoint: existing.endpoint }));
  });

  it('reports failed when the server refuses', async () => {
    installBrowser();
    rpc.mockResolvedValue({ error: { message: 'not a push service' } });
    expect(await subscribeDevice()).toBe('failed');
  });

  it('unsubscribes the browser and the server', async () => {
    const existing = fakeSubscription();
    installBrowser({ existing });
    await unsubscribeDevice();
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('push_unsubscribe', { p_endpoint: existing.endpoint });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/lib/pushClient.spec.ts`
Expected: FAIL, `Cannot find module './pushClient'`.

- [ ] **Step 3: Implement**

`src/lib/pushClient.ts`:

```ts
// Browser plumbing for push reminders: register the worker, ask permission,
// subscribe, and tell the server. UI code goes through usePushReminder.
import { getSupabaseForCity } from '@/lib/supabase';
import { DEFAULT_CITY_ID } from '@/config/cities';
import { env } from '@/config/env';
import { withBasePath } from '@/lib/constants';

export const PUSH_SW_PATH = '/push-sw.js';

export type EnableResult = 'enabled' | 'denied' | 'failed';

// Subscriptions live in the hub project. The default city reads the shared
// NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY, which is the hub, and its schema
// (dev / public) follows NEXT_PUBLIC_SUPABASE_SCHEMA like every other query.
function hub() {
  return getSupabaseForCity(DEFAULT_CITY_ID);
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  } catch {
    return 'Europe/Warsaw';
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(withBasePath('/'));
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Sends (or refreshes) this browser's subscription, with its current timezone. */
export async function sendSubscription(sub: PushSubscription): Promise<void> {
  const keys = sub.toJSON().keys ?? {};
  const { error } = await hub().rpc('push_subscribe', {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh ?? '',
    p_auth: keys.auth ?? '',
    p_tz: deviceTimeZone(),
  });
  if (error) throw new Error(error.message);
}

/** Must be called from a click: browsers refuse a permission prompt otherwise. */
export async function subscribeDevice(): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    await navigator.serviceWorker.register(withBasePath(PUSH_SW_PATH), { scope: withBasePath('/') });
    // subscribe() needs an ACTIVE worker; `ready` resolves once there is one.
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      }));
    await sendSubscription(sub);
    return 'enabled';
  } catch {
    return 'failed';
  }
}

export async function unsubscribeDevice(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  // If this call fails, the server row goes on its own: the push service
  // answers 410 for an unsubscribed endpoint and push_record deletes the row.
  await hub().rpc('push_unsubscribe', { p_endpoint: endpoint });
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm vitest run src/lib/pushClient.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pushClient.ts src/lib/pushClient.spec.ts
git commit -m "feat(push): register, subscribe and unsubscribe through the hub RPCs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The `usePushReminder` hook

**Files:**
- Modify: `src/components/service/usePresets.ts` (export one reader)
- Create: `src/components/service/usePushReminder.spec.tsx`
- Create: `src/components/service/usePushReminder.ts`

- [ ] **Step 1: Export a fresh reader from usePresets**

The hook checks the mark against what is in `localStorage` NOW, not against the hook's first render. During hydration `usePresets` briefly returns `[]`, and checking against that empty list would wipe the mark. In `src/components/service/usePresets.ts`, add after `getServerSnapshot`:

```ts
/** The saved filters as they are in storage right now, outside React. */
export function readStoredPresets(): FilterPreset[] {
  return parsePresets(getSnapshot());
}
```

- [ ] **Step 2: Write the failing tests**

`src/components/service/usePushReminder.spec.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterPreset } from '@/types/preset.types';

vi.mock('@/config/site', () => ({ IS_PUSH_ENABLED: true }));
vi.mock('@/lib/pushSupport', () => ({ pushSupport: vi.fn(() => 'ready') }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/pushClient', () => ({
  currentSubscription: vi.fn(),
  sendSubscription: vi.fn(async () => undefined),
  subscribeDevice: vi.fn(),
  unsubscribeDevice: vi.fn(async () => undefined),
}));
vi.mock('@/lib/pushSettingsStore', () => ({
  readPushSettings: vi.fn(),
  writePushSettings: vi.fn(async () => undefined),
  clearPushSettings: vi.fn(async () => undefined),
}));
vi.mock('@/components/service/usePresets', () => ({ readStoredPresets: vi.fn(() => []) }));

import { usePushReminder } from './usePushReminder';
import * as client from '@/lib/pushClient';
import * as store from '@/lib/pushSettingsStore';
import { pushSupport } from '@/lib/pushSupport';
import { trackEvent } from '@/lib/analytics';
import { readStoredPresets } from '@/components/service/usePresets';

const preset = (id: string, name = id) => ({ id, name }) as FilterPreset;
const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/x' } as PushSubscription;

describe('usePushReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(pushSupport).mockReturnValue('ready');
    vi.mocked(client.currentSubscription).mockResolvedValue(null);
    vi.mocked(store.readPushSettings).mockResolvedValue(null);
    vi.mocked(readStoredPresets).mockReturnValue([]);
  });

  it('starts off and reports support', async () => {
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    expect(result.current.available).toBe(true);
    expect(result.current.enabled).toBe(false);
  });

  it('is on when the browser has a subscription AND the record exists, and refreshes once per session', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: { id: 'a', name: 'A' } });
    vi.mocked(readStoredPresets).mockReturnValue([preset('a', 'A')]);
    const { result, unmount } = renderHook(() => usePushReminder([preset('a', 'A')]));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.markedId).toBe('a');
    expect(client.sendSubscription).toHaveBeenCalledTimes(1);
    unmount();

    renderHook(() => usePushReminder([preset('a', 'A')]));
    await waitFor(() => expect(client.currentSubscription).toHaveBeenCalledTimes(2));
    expect(client.sendSubscription).toHaveBeenCalledTimes(1);
  });

  it('enable writes the record and counts the event', async () => {
    vi.mocked(client.subscribeDevice).mockResolvedValue('enabled');
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    await act(async () => {
      expect(await result.current.enable()).toBe('enabled');
    });
    expect(store.writePushSettings).toHaveBeenCalledWith({ locale: 'pl', preset: null });
    expect(result.current.enabled).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith('push_enable');
  });

  it('a refused permission is counted and re-checks support', async () => {
    vi.mocked(client.subscribeDevice).mockResolvedValue('denied');
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    vi.mocked(pushSupport).mockReturnValue('blocked');
    await act(async () => {
      await result.current.enable();
    });
    expect(trackEvent).toHaveBeenCalledWith('push_denied');
    expect(result.current.support).toBe('blocked');
    expect(result.current.enabled).toBe(false);
  });

  it('marking while off turns reminders on first, then marks', async () => {
    vi.mocked(client.subscribeDevice).mockResolvedValue('enabled');
    // The filter exists in storage, or the reconcile effect would drop the mark.
    vi.mocked(readStoredPresets).mockReturnValue([preset('b', 'B')]);
    const { result } = renderHook(() => usePushReminder([preset('b', 'B')]));
    await waitFor(() => expect(result.current.support).toBe('ready'));
    await act(async () => {
      expect(await result.current.toggleMark(preset('b', 'B'))).toBe('marked');
    });
    expect(client.subscribeDevice).toHaveBeenCalled();
    expect(store.writePushSettings).toHaveBeenLastCalledWith({ locale: 'pl', preset: { id: 'b', name: 'B' } });
    expect(result.current.markedId).toBe('b');
    expect(trackEvent).toHaveBeenCalledWith('push_filter_on');
  });

  it('toggling the marked filter unmarks it', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: { id: 'a', name: 'A' } });
    vi.mocked(readStoredPresets).mockReturnValue([preset('a', 'A')]);
    const { result } = renderHook(() => usePushReminder([preset('a', 'A')]));
    await waitFor(() => expect(result.current.markedId).toBe('a'));
    await act(async () => {
      expect(await result.current.toggleMark(preset('a', 'A'))).toBe('unmarked');
    });
    expect(result.current.markedId).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('push_filter_off');
  });

  it('drops the mark when the marked filter no longer exists in storage', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: { id: 'gone', name: 'G' } });
    vi.mocked(readStoredPresets).mockReturnValue([preset('other')]);
    const { result } = renderHook(() => usePushReminder([preset('other')]));
    await waitFor(() => expect(store.writePushSettings).toHaveBeenCalledWith({ locale: 'pl', preset: null }));
    await waitFor(() => expect(result.current.markedId).toBeNull());
  });

  it('disable unsubscribes, deletes the record and counts the event', async () => {
    vi.mocked(client.currentSubscription).mockResolvedValue(SUB);
    vi.mocked(store.readPushSettings).mockResolvedValue({ locale: 'pl', preset: null });
    const { result } = renderHook(() => usePushReminder([]));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.disable();
    });
    expect(client.unsubscribeDevice).toHaveBeenCalled();
    expect(store.clearPushSettings).toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('push_disable');
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm vitest run src/components/service/usePushReminder.spec.tsx`
Expected: FAIL, `Cannot find module './usePushReminder'`.

- [ ] **Step 4: Implement**

`src/components/service/usePushReminder.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { IS_PUSH_ENABLED } from '@/config/site';
import { trackEvent } from '@/lib/analytics';
import { pushSupport, type PushSupport } from '@/lib/pushSupport';
import {
  currentSubscription,
  sendSubscription,
  subscribeDevice,
  unsubscribeDevice,
  type EnableResult,
} from '@/lib/pushClient';
import {
  clearPushSettings,
  readPushSettings,
  writePushSettings,
  type PushSettings,
} from '@/lib/pushSettingsStore';
import { markPreset, reconcileMark } from '@/lib/pushMark';
import { readStoredPresets } from '@/components/service/usePresets';
import type { FilterPreset } from '@/types/preset.types';

const REFRESHED_KEY = 'idznamiasto.push.refreshed';

export interface PushReminder {
  /** The feature flag. False = render nothing. */
  available: boolean;
  support: PushSupport | 'checking';
  enabled: boolean;
  markedId: string | null;
  busy: boolean;
  enable(): Promise<EnableResult>;
  disable(): Promise<void>;
  /** Marks this filter (turning reminders on first if needed), or unmarks it if it is the marked one. */
  toggleMark(preset: FilterPreset): Promise<EnableResult | 'marked' | 'unmarked'>;
}

function refreshedThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(REFRESHED_KEY)) return true;
    window.sessionStorage.setItem(REFRESHED_KEY, '1');
  } catch {
    // Storage blocked: refresh every visit, which is harmless.
  }
  return false;
}

/**
 * Push reminders for one component tree. `presets` is only a trigger: when
 * it changes, the stored mark is reconciled against storage as it is NOW
 * (readStoredPresets), never against a hydration-time empty list.
 */
export function usePushReminder(presets: readonly FilterPreset[]): PushReminder {
  const { locale } = useTranslation();
  const [support, setSupport] = useState<PushSupport | 'checking'>('checking');
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!IS_PUSH_ENABLED) return;
    let cancelled = false;
    const load = async () => {
      const found = pushSupport(navigator, window);
      setSupport(found);
      if (found !== 'ready') return;
      const [sub, stored] = await Promise.all([
        currentSubscription().catch(() => null),
        readPushSettings().catch(() => null),
      ]);
      if (cancelled) return;
      const on = Boolean(sub && stored);
      setEnabled(on);
      setSettings(on ? stored : null);
      // Keeps tz current and replaces a subscription the browser rotated.
      if (on && sub && !refreshedThisSession()) sendSubscription(sub).catch(() => undefined);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rename / delete of the marked filter, and a language switch.
  useEffect(() => {
    if (!settings) return;
    let next = reconcileMark(settings, readStoredPresets());
    if (next.locale !== locale) next = { ...next, locale };
    if (next === settings) return;
    void writePushSettings(next)
      .then(() => setSettings(next))
      .catch(() => undefined);
  }, [settings, presets, locale]);

  const enable = useCallback(async (): Promise<EnableResult> => {
    setBusy(true);
    try {
      const result = await subscribeDevice();
      if (result === 'denied') {
        trackEvent('push_denied');
        setSupport(pushSupport(navigator, window));
        return result;
      }
      if (result === 'failed') return result;
      const next: PushSettings = { locale, preset: settings?.preset ?? null };
      await writePushSettings(next);
      setSettings(next);
      setEnabled(true);
      trackEvent('push_enable');
      return result;
    } finally {
      setBusy(false);
    }
  }, [locale, settings]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeDevice().catch(() => undefined);
      await clearPushSettings().catch(() => undefined);
      setSettings(null);
      setEnabled(false);
      trackEvent('push_disable');
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleMark = useCallback(
    async (preset: FilterPreset) => {
      const unmarking = settings?.preset?.id === preset.id;
      if (!enabled) {
        const result = await enable();
        if (result !== 'enabled') return result;
      }
      const next = markPreset({ locale, preset: settings?.preset ?? null }, unmarking ? null : preset);
      await writePushSettings(next);
      setSettings(next);
      trackEvent(unmarking ? 'push_filter_off' : 'push_filter_on');
      return unmarking ? ('unmarked' as const) : ('marked' as const);
    },
    [enabled, enable, locale, settings]
  );

  return {
    available: IS_PUSH_ENABLED,
    support,
    enabled,
    markedId: settings?.preset?.id ?? null,
    busy,
    enable,
    disable,
    toggleMark,
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm vitest run src/components/service/usePushReminder.spec.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: no errors. `setSupport(found)` sits inside the async `load`, which the `react-hooks/set-state-in-effect` rule should allow. If it is flagged anyway:
1. Add `await Promise.resolve();` at the top of `load`.
2. Move `const found = pushSupport(...)` and `setSupport(found)` after that line.
3. Re-run the lint.

- [ ] **Step 7: Commit**

```bash
git add src/components/service/usePresets.ts src/components/service/usePushReminder.ts src/components/service/usePushReminder.spec.tsx
git commit -m "feat(push): usePushReminder hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Messages

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: Add the Polish strings**

In `src/i18n/messages.ts`, inside `const pl = {`, right after the `PRESETS_META_DESCRIPTION` entry, add:

```ts
  // Push reminders: the /moje-filtry card, the tile bell, the save toast.
  PUSH_CARD_TITLE: 'Przypomnienia',
  PUSH_CARD_BODY:
    'Kilka razy w tygodniu, w południe, przypomnimy Ci, żeby zajrzeć, co nowego. Zaznacz dzwonkiem jeden filtr, a przypomnienie otworzy właśnie jego.',
  PUSH_SWITCH: 'Przypominaj mi',
  PUSH_BLOCKED:
    'Powiadomienia z tej strony są zablokowane. Odblokujesz je w ustawieniach przeglądarki (ikona przy adresie strony).',
  PUSH_FAILED: 'Nie udało się włączyć przypomnień. Spróbuj ponownie za chwilę.',
  PUSH_IOS_BUTTON: 'Jak włączyć na iPhonie',
  PUSH_IOS_TITLE: 'Przypomnienia na iPhonie',
  PUSH_IOS_STEPS: [
    'Stuknij „Udostępnij” na pasku Safari.',
    'Wybierz „Do ekranu początkowego”.',
    'Otwórz Idź na miasto z ikony na ekranie i włącz przypomnienia tutaj.',
  ],
  PUSH_IOS_CLOSE: 'Rozumiem',
  PUSH_MARK: 'Przypominaj o tym filtrze',
  PUSH_SAVED_ACTION: 'Przypominaj o nim',
```

and, right after `PRIVACY_WITHDRAW_BODY` (Polish):

```ts
  PRIVACY_PUSH_HEADING: 'Przypomnienia',
  PRIVACY_PUSH_BODY:
    'Jeśli włączysz przypomnienia, zapisujemy techniczny adres powiadomień Twojej przeglądarki, dwa klucze szyfrujące, strefę czasową i czas ostatniego przypomnienia. Nie zapisujemy Twoich filtrów ani preferencji: to, który filtr jest zaznaczony dzwonkiem, zostaje w telefonie. Przypomnienia wyłączysz przełącznikiem w „Moich filtrach” albo usuwając dane strony w przeglądarce; wtedy adres usuwamy.',
```

- [ ] **Step 2: Add the English strings**

Inside `const en = {`, after its `PRESETS_META_DESCRIPTION`:

```ts
  PUSH_CARD_TITLE: 'Reminders',
  PUSH_CARD_BODY:
    "A few times a week, at noon, we'll remind you to look at what's new. Mark one filter with the bell and the reminder opens that one.",
  PUSH_SWITCH: 'Remind me',
  PUSH_BLOCKED:
    "Notifications from this site are blocked. You can unblock them in your browser's settings (the icon next to the address).",
  PUSH_FAILED: 'Reminders could not be switched on. Try again in a moment.',
  PUSH_IOS_BUTTON: 'How to switch them on on an iPhone',
  PUSH_IOS_TITLE: 'Reminders on an iPhone',
  PUSH_IOS_STEPS: [
    'Tap "Share" in the Safari toolbar.',
    'Choose "Add to Home Screen".',
    'Open Idź na miasto from the icon and switch reminders on here.',
  ],
  PUSH_IOS_CLOSE: 'Got it',
  PUSH_MARK: 'Remind me about this filter',
  PUSH_SAVED_ACTION: 'Remind me about it',
```

and after the English `PRIVACY_WITHDRAW_BODY`:

```ts
  PRIVACY_PUSH_HEADING: 'Reminders',
  PRIVACY_PUSH_BODY:
    'If you switch reminders on, we store your browser\'s technical notification address, two encryption keys, your timezone and when the last reminder went out. We store none of your filters or preferences: which filter carries the bell stays on your phone. Switch reminders off with the switch in "My filters", or by removing the site\'s data in your browser, and we delete the address.',
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS. `en satisfies Messages` fails if a key is missing on either side.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(push): reminder and privacy strings (pl, en)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: The reminder card and the iPhone dialog

**Files:**
- Create: `src/components/common/PushReminderCard/IosInstallDialog.tsx`
- Create: `src/components/common/PushReminderCard/PushReminderCard.spec.tsx`
- Create: `src/components/common/PushReminderCard/PushReminderCard.tsx`

- [ ] **Step 1: Write the failing tests**

`src/components/common/PushReminderCard/PushReminderCard.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { PushReminder } from '@/components/service/usePushReminder';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { trackEvent } from '@/lib/analytics';
import PushReminderCard from './PushReminderCard';

function reminder(over: Partial<PushReminder> = {}): PushReminder {
  return {
    available: true,
    support: 'ready',
    enabled: false,
    markedId: null,
    busy: false,
    enable: vi.fn(async () => 'enabled' as const),
    disable: vi.fn(async () => undefined),
    toggleMark: vi.fn(async () => 'marked' as const),
    ...over,
  };
}

describe('PushReminderCard', () => {
  it('renders nothing when the feature is off or unsupported', () => {
    const { container, rerender } = render(<PushReminderCard reminder={reminder({ available: false })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PushReminderCard reminder={reminder({ support: 'unsupported' })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PushReminderCard reminder={reminder({ support: 'checking' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the switch turns reminders on and off', async () => {
    const r = reminder();
    const { rerender } = render(<PushReminderCard reminder={r} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Przypominaj mi' }));
    expect(r.enable).toHaveBeenCalled();

    const on = reminder({ enabled: true });
    rerender(<PushReminderCard reminder={on} />);
    expect(screen.getByRole('switch', { name: 'Przypominaj mi' })).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Przypominaj mi' }));
    expect(on.disable).toHaveBeenCalled();
  });

  it('says so when switching on failed', async () => {
    render(<PushReminderCard reminder={reminder({ enable: vi.fn(async () => 'failed' as const) })} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Przypominaj mi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się włączyć przypomnień');
  });

  it('explains a blocked permission instead of offering the switch', () => {
    render(<PushReminderCard reminder={reminder({ support: 'blocked' })} />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText(/są zablokowane/)).toBeInTheDocument();
  });

  it('on an iPhone in Safari shows the install steps', async () => {
    render(<PushReminderCard reminder={reminder({ support: 'ios-install-first' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Jak włączyć na iPhonie' }));
    expect(await screen.findByRole('dialog', { name: 'Przypomnienia na iPhonie' })).toBeInTheDocument();
    expect(screen.getByText(/Do ekranu początkowego/)).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('push_ios_install_shown');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PushReminderCard reminder={reminder()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/components/common/PushReminderCard/PushReminderCard.spec.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the dialog**

`src/components/common/PushReminderCard/IosInstallDialog.tsx`:

```tsx
'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTranslation } from '@/i18n';

interface IosInstallDialogProps {
  open: boolean;
  onClose: () => void;
}

// iOS delivers web push only to Home Screen web apps, and from iOS 26 every
// Home Screen site opens as one. These are the three taps that get there.
export default function IosInstallDialog({ open, onClose }: IosInstallDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="push-ios-title" fullWidth maxWidth="xs">
      <DialogTitle id="push-ios-title" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
        {t.PUSH_IOS_TITLE}
      </DialogTitle>
      <DialogContent>
        <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {t.PUSH_IOS_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          {t.PUSH_IOS_CLOSE}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4: Write the card**

`src/components/common/PushReminderCard/PushReminderCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/lib/analytics';
import type { PushReminder } from '@/components/service/usePushReminder';
import IosInstallDialog from './IosInstallDialog';

interface PushReminderCardProps {
  reminder: PushReminder;
}

/** The on/off switch for push reminders, at the top of /moje-filtry. */
export default function PushReminderCard({ reminder }: PushReminderCardProps) {
  const { t } = useTranslation();
  const [iosOpen, setIosOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!reminder.available || reminder.support === 'unsupported' || reminder.support === 'checking') {
    return null;
  }

  const toggle = async (on: boolean) => {
    setFailed(false);
    if (on) {
      if ((await reminder.enable()) === 'failed') setFailed(true);
    } else {
      await reminder.disable();
    }
  };

  return (
    <Box
      component="section"
      aria-labelledby="push-card-title"
      sx={{ border: '1px solid var(--color-border)', borderRadius: 2, p: 2, mb: 3 }}
    >
      <Typography
        id="push-card-title"
        variant="h2"
        sx={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <NotificationsActiveOutlinedIcon fontSize="small" aria-hidden="true" />
        {t.PUSH_CARD_TITLE}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5, mb: 1 }}>
        {t.PUSH_CARD_BODY}
      </Typography>

      {reminder.support === 'ready' && (
        <FormControlLabel
          control={
            <Switch
              checked={reminder.enabled}
              disabled={reminder.busy}
              onChange={(e) => void toggle(e.target.checked)}
              slotProps={{ input: { role: 'switch' } }}
            />
          }
          label={t.PUSH_SWITCH}
        />
      )}

      {reminder.support === 'blocked' && (
        <Typography variant="body2" role="status">
          {t.PUSH_BLOCKED}
        </Typography>
      )}

      {reminder.support === 'ios-install-first' && (
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            trackEvent('push_ios_install_shown');
            setIosOpen(true);
          }}
        >
          {t.PUSH_IOS_BUTTON}
        </Button>
      )}

      {failed && (
        <Typography variant="body2" role="alert" sx={{ color: 'error.main', mt: 1 }}>
          {t.PUSH_FAILED}
        </Typography>
      )}

      <IosInstallDialog open={iosOpen} onClose={() => setIosOpen(false)} />
    </Box>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm vitest run src/components/common/PushReminderCard/PushReminderCard.spec.tsx`
Expected: PASS (6 tests). If `getByRole('switch')` finds nothing, this MUI version passes the input role as `inputProps={{ role: 'switch' }}`. Use that instead of `slotProps` and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/components/common/PushReminderCard
git commit -m "feat(push): reminder card and iPhone install dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: `/moje-filtry`: card, bells, and `?open=`

**Files:**
- Modify: `src/components/views/MyFiltersView/MyFiltersView.tsx`
- Modify: `src/components/views/MyFiltersView/MyFiltersView.spec.tsx`

- [ ] **Step 1: Write the failing tests**

At the top of `src/components/views/MyFiltersView/MyFiltersView.spec.tsx`, after the existing imports and before the existing `vi.mock` calls, add:

```tsx
import type { PushReminder } from '@/components/service/usePushReminder';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const reminderState: { current: PushReminder } = {
  current: {
    available: false,
    support: 'checking',
    enabled: false,
    markedId: null,
    busy: false,
    enable: vi.fn(),
    disable: vi.fn(),
    toggleMark: vi.fn(),
  },
};
vi.mock('@/components/service/usePushReminder', () => ({ usePushReminder: () => reminderState.current }));
```

At the end of the file, add a new `describe` block:

```tsx
describe('MyFiltersView push reminders', () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockReset();
    window.history.replaceState(null, '', '/moje-filtry/');
    reminderState.current = {
      available: true,
      support: 'ready',
      enabled: true,
      markedId: null,
      busy: false,
      enable: vi.fn(),
      disable: vi.fn(),
      toggleMark: vi.fn(async () => 'marked' as const),
    };
  });

  it('shows the reminder card, also with no filters saved', () => {
    render(<MyFiltersView />);
    expect(screen.getByRole('heading', { level: 2, name: 'Przypomnienia' })).toBeInTheDocument();
  });

  it('each tile has a bell that marks that filter', async () => {
    seed([preset()]);
    render(<MyFiltersView />);
    const bell = screen.getByRole('button', { name: 'Przypominaj o tym filtrze' });
    expect(bell).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(bell);
    expect(reminderState.current.toggleMark).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });

  it('the marked filter shows a pressed bell', () => {
    reminderState.current.markedId = 'p1';
    seed([preset()]);
    render(<MyFiltersView />);
    expect(screen.getByRole('button', { name: 'Przypominaj o tym filtrze' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('no bells when reminders are not available', () => {
    reminderState.current.available = false;
    seed([preset()]);
    render(<MyFiltersView />);
    expect(screen.queryByRole('button', { name: 'Przypominaj o tym filtrze' })).not.toBeInTheDocument();
  });

  it('?open=<id> goes straight to that filter', () => {
    seed([preset()]);
    window.history.replaceState(null, '', '/moje-filtry/?open=p1');
    render(<MyFiltersView />);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/wroclaw/wydarzenia'));
  });

  it('?open= with an unknown id stays on the list', () => {
    seed([preset()]);
    window.history.replaceState(null, '', '/moje-filtry/?open=gone');
    render(<MyFiltersView />);
    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to see the new ones fail**

Run: `pnpm vitest run src/components/views/MyFiltersView/MyFiltersView.spec.tsx`
Expected: the existing tests PASS, and the 6 new ones FAIL (no card, no bell, no redirect).

- [ ] **Step 3: Implement**

In `src/components/views/MyFiltersView/MyFiltersView.tsx`:

Change the React import to `import { useEffect, useState } from 'react';` and add these imports:

```tsx
import { useRouter } from 'next/navigation';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { usePushReminder } from '@/components/service/usePushReminder';
import PushReminderCard from '@/components/common/PushReminderCard/PushReminderCard';
import { presetToOpen } from '@/lib/pushOpen';
```

After `const [draft, setDraft] = useState<FilterPreset | null>(null);` add:

```tsx
  const router = useRouter();
  const reminder = usePushReminder(presets);
  const showBells = reminder.available && reminder.support === 'ready';

  // A reminder for a marked filter lands here as ?open=<id>. The filter's link
  // depends on the day it is opened ("W weekend" means the coming weekend), so
  // it is resolved now, from the filter as it is now. Re-runs when presets
  // arrive: during hydration the list is briefly empty.
  useEffect(() => {
    const target = presetToOpen(window.location.search, presets);
    if (target) router.replace(presetHref(target, new Date()) as Route);
  }, [presets, router]);
```

Directly after the closing `</header>`, add:

```tsx
      <PushReminderCard reminder={reminder} />
```

Inside `<div className={styles.tileActions}>`, before the Edit `<Tooltip>`, add:

```tsx
                    {showBells && (
                      <Tooltip title={t.PUSH_MARK}>
                        <IconButton
                          size="small"
                          aria-label={t.PUSH_MARK}
                          aria-pressed={reminder.markedId === preset.id}
                          disabled={reminder.busy}
                          onClick={() => void reminder.toggleMark(preset)}
                        >
                          {reminder.markedId === preset.id ? (
                            <NotificationsActiveIcon fontSize="small" />
                          ) : (
                            <NotificationsNoneIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
```

- [ ] **Step 4: Run all of the file's tests**

Run: `pnpm vitest run src/components/views/MyFiltersView/MyFiltersView.spec.tsx`
Expected: PASS (the existing tests plus the 6 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/components/views/MyFiltersView/MyFiltersView.tsx src/components/views/MyFiltersView/MyFiltersView.spec.tsx
git commit -m "feat(push): reminder card, tile bells and ?open= on /moje-filtry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Offer the reminder right after saving a filter

**Files:**
- Modify: `src/components/common/SavePresetButton/SavePresetButton.tsx`
- Modify: `src/components/common/SavePresetButton/SavePresetButton.spec.tsx`

- [ ] **Step 1: Write the failing tests**

At the top of `SavePresetButton.spec.tsx`, after the existing imports, add:

```tsx
import type { PushReminder } from '@/components/service/usePushReminder';

const toggleMark = vi.fn(async () => 'marked' as const);
const reminderState: { current: Partial<PushReminder> } = { current: { available: false, support: 'checking' } };
vi.mock('@/components/service/usePushReminder', () => ({
  usePushReminder: () => ({ markedId: null, busy: false, enabled: false, toggleMark, ...reminderState.current }),
}));
```

If the file does not import `vi` yet, add it to the vitest import. At the end of the file add:

```tsx
describe('SavePresetButton push offer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    toggleMark.mockClear();
  });

  async function saveOne() {
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz filtry' }));
    await userEvent.type(screen.getByLabelText('Nazwa'), 'Koncerty');
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
  }

  it('offers to remind about the filter just saved', async () => {
    reminderState.current = { available: true, support: 'ready' };
    render(<SavePresetButton filters={EMPTY_FILTERS} cityId="wroclaw" />);
    await saveOne();
    await userEvent.click(await screen.findByRole('button', { name: 'Przypominaj o nim' }));
    expect(toggleMark).toHaveBeenCalledWith(expect.objectContaining({ name: 'Koncerty', cityId: 'wroclaw' }));
  });

  it('does not offer it when reminders are not available here', async () => {
    reminderState.current = { available: false, support: 'checking' };
    render(<SavePresetButton filters={EMPTY_FILTERS} cityId="wroclaw" />);
    await saveOne();
    await screen.findByText('Zapisano w „Moje filtry”');
    expect(screen.queryByRole('button', { name: 'Przypominaj o nim' })).not.toBeInTheDocument();
  });
});
```

`EMPTY_FILTERS` is a stand-in. Read the top of the file, find the filters object the existing tests already pass to `<SavePresetButton filters={...}>`, and use that exact value and its name in place of `EMPTY_FILTERS`.

- [ ] **Step 2: Run them to see the new ones fail**

Run: `pnpm vitest run src/components/common/SavePresetButton/SavePresetButton.spec.tsx`
Expected: the existing tests PASS, and the first new one FAILS (there is no "Przypominaj o nim" button yet).

- [ ] **Step 3: Implement**

In `SavePresetButton.tsx` add the imports:

```tsx
import { usePushReminder } from '@/components/service/usePushReminder';
import type { FilterPreset } from '@/types/preset.types';
```

After `const [dateWindow, ...] = useState...` add:

```tsx
  const reminder = usePushReminder(presets);
  // The filter this toast is about, so its action can mark exactly that one.
  const [savedPreset, setSavedPreset] = useState<FilterPreset | null>(null);
```

Replace the body of `submit` with:

```tsx
  const submit = () => {
    if (!trimmed) return;
    const preset: FilterPreset = {
      id: newPresetId(),
      name: trimmed.slice(0, MAX_NAME_LENGTH),
      cityId,
      filters: presetFiltersFromEventFilters(filters, dateWindow),
      createdAt: new Date().toISOString(),
    };
    save(preset);
    setSavedPreset(preset);
    setOpen(false);
    setName('');
    setSaved(true);
  };
```

Replace the Snackbar's `action` prop with:

```tsx
        action={
          <>
            {reminder.available &&
              reminder.support === 'ready' &&
              savedPreset &&
              reminder.markedId !== savedPreset.id && (
                <Button
                  size="small"
                  sx={{ color: 'var(--accent)' }}
                  onClick={() => {
                    void reminder.toggleMark(savedPreset);
                    setSaved(false);
                  }}
                >
                  {t.PUSH_SAVED_ACTION}
                </Button>
              )}
            <Button component={Link} href={MY_FILTERS_PATH as Route} size="small" sx={{ color: 'var(--accent)' }}>
              {t.NAV_PRESETS}
            </Button>
          </>
        }
```

- [ ] **Step 4: Run all of the file's tests**

Run: `pnpm vitest run src/components/common/SavePresetButton/SavePresetButton.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/SavePresetButton
git commit -m "feat(push): offer a reminder for a filter right after saving it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Counting opens (`push_open`)

**Files:**
- Create: `src/components/common/PushOpenTracker/PushOpenTracker.spec.tsx`
- Create: `src/components/common/PushOpenTracker/PushOpenTracker.tsx`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Write the failing tests**

`src/components/common/PushOpenTracker/PushOpenTracker.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { trackEvent } from '@/lib/analytics';
import PushOpenTracker from './PushOpenTracker';

describe('PushOpenTracker', () => {
  beforeEach(() => {
    vi.mocked(trackEvent).mockClear();
  });

  it('counts a visit from a reminder once and strips the marker', () => {
    window.history.replaceState(null, '', '/moje-filtry/?open=p1&src=push');
    render(<PushOpenTracker />);
    expect(trackEvent).toHaveBeenCalledWith('push_open');
    expect(window.location.search).toBe('?open=p1');
  });

  it('ignores an ordinary visit', () => {
    window.history.replaceState(null, '', '/?a=1');
    render(<PushOpenTracker />);
    expect(trackEvent).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?a=1');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/components/common/PushOpenTracker/PushOpenTracker.spec.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/components/common/PushOpenTracker/PushOpenTracker.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { stripPushSource } from '@/lib/pushOpen';

/**
 * Counts a visit that came from a reminder (`src=push`) and removes the marker
 * from the URL, so a shared or reloaded link does not count again. Mounted
 * once, in Providers; re-checks on every route change.
 */
export default function PushOpenTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const stripped = stripPushSource(window.location.href);
    if (!stripped) return;
    trackEvent('push_open');
    window.history.replaceState(window.history.state, '', stripped);
  }, [pathname]);
  return null;
}
```

- [ ] **Step 4: Mount it**

In `src/app/providers.tsx`, add the import

```tsx
import PushOpenTracker from '@/components/common/PushOpenTracker/PushOpenTracker';
```

and render it next to `<CssBaseline />`:

```tsx
              <CssBaseline />
              <PushOpenTracker />
              {children}
```

- [ ] **Step 5: Run the tests, and the layout tests that render Providers**

Run: `pnpm vitest run src/components/common/PushOpenTracker src/app`
Expected: PASS. If `src/app/layout.spec.tsx` renders `Providers` without a `next/navigation` mock and now fails on `usePathname`, add `vi.mock('next/navigation', () => ({ usePathname: () => '/' }))` to that spec.

- [ ] **Step 6: Commit**

```bash
git add src/components/common/PushOpenTracker src/app/providers.tsx src/app/layout.spec.tsx
git commit -m "feat(push): count visits from a reminder (push_open)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Privacy page section

**Files:**
- Modify: `src/components/views/PrivacyView/PrivacyView.tsx`
- Modify: `src/components/views/PrivacyView/PrivacyView.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add to `PrivacyView.spec.tsx`, inside the `describe`:

```tsx
  it('explains what push reminders store, and that the marked filter stays on the phone', () => {
    render(<PrivacyView />);
    expect(screen.getByRole('heading', { level: 2, name: 'Przypomnienia' })).toBeInTheDocument();
    expect(screen.getByText(/strefę czasową i czas ostatniego przypomnienia/)).toBeInTheDocument();
    expect(screen.getByText(/zostaje w telefonie/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/components/views/PrivacyView/PrivacyView.spec.tsx`
Expected: the new test FAILS.

- [ ] **Step 3: Implement**

In `PrivacyView.tsx`, add to `sections`, after `location`:

```tsx
    { key: 'push', heading: t.PRIVACY_PUSH_HEADING, body: t.PRIVACY_PUSH_BODY },
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm vitest run src/components/views/PrivacyView/PrivacyView.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/PrivacyView
git commit -m "docs(privacy): what push reminders store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: e2e, build vars and deployment docs

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/push-reminder.spec.ts`
- Modify: `.github/workflows/ci.yml`, `.github/workflows/deploy-dev.yml`, `.github/workflows/deploy-prod.yml`
- Modify: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Turn the flag on for the e2e dev server**

In `playwright.config.ts`, change the `webServer.env` line to:

```ts
    // Push reminders on, with a public VAPID key (public by definition; the
    // e2e stubs the push service, so no private half exists anywhere).
    env: {
      NEXT_PUBLIC_BASE_PATH: '',
      NEXT_PUBLIC_PUSH_ENABLED: 'true',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY:
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    },
```

- [ ] **Step 2: Write the e2e test**

`e2e/push-reminder.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// The browser's push service cannot be reached from CI, so the service worker
// and PushManager are stubbed. What this proves is everything around them: the
// card, the permission click, the RPC the server receives, the bell, and that
// both survive a reload (IndexedDB is real here).
test.describe('Push reminders on /moje-filtry', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = 'e2e.push.subscribed';
      const endpoint = 'https://fcm.googleapis.com/fcm/send/e2e';
      const sub = {
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
        unsubscribe: async () => {
          localStorage.removeItem(KEY);
          return true;
        },
      };
      const pushManager = {
        getSubscription: async () => (localStorage.getItem(KEY) ? sub : null),
        subscribe: async () => {
          localStorage.setItem(KEY, '1');
          return sub;
        },
      };
      const reg = { pushManager };
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { register: async () => reg, getRegistration: async () => reg, ready: Promise.resolve(reg) },
      });
      (window as unknown as { PushManager: unknown }).PushManager ??= function PushManager() {};
      Notification.requestPermission = async () => 'granted';
    });
    await page.route('**/rest/v1/rpc/push_*', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto('/moje-filtry');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.localStorage.setItem(
        'go-to-city.presets',
        JSON.stringify([
          {
            id: 'e2e-1',
            name: 'Taniec e2e',
            cityId: 'wroclaw',
            createdAt: '2026-11-05T10:00:00.000Z',
            filters: {
              search: '', categories: ['taniec'], dateWindow: 'weekend', dateFrom: null, dateTo: null,
              weekdays: [], hourFrom: null, hourTo: null, freeOnly: false, near: null, season: null,
              viewMode: 'grid', pageSize: 15,
            },
          },
        ])
      );
    });
    await page.reload();
  });

  test('switching on sends the subscription with a timezone, and the bell marks a filter', async ({ page }) => {
    const subscribe = page.waitForRequest('**/rest/v1/rpc/push_subscribe');
    await page.getByRole('switch', { name: 'Przypominaj mi' }).click();
    const body = (await subscribe).postDataJSON();
    expect(body.p_endpoint).toBe('https://fcm.googleapis.com/fcm/send/e2e');
    expect(typeof body.p_tz).toBe('string');
    await expect(page.getByRole('switch', { name: 'Przypominaj mi' })).toBeChecked();

    const bell = page.getByRole('button', { name: 'Przypominaj o tym filtrze' });
    await bell.click();
    await expect(bell).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByRole('switch', { name: 'Przypominaj mi' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Przypominaj o tym filtrze' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a reminder link opens the marked filter', async ({ page }) => {
    await page.goto('/moje-filtry/?open=e2e-1&src=push');
    await expect(page).toHaveURL(/\/wroclaw\/wydarzenia\/?\?.*categories=taniec/);
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm test:e2e e2e/push-reminder.spec.ts --project=chromium`
Expected: 2 passed. Like every e2e test here, it needs `.env.local` with the Supabase vars.

- [ ] **Step 4: Run the whole e2e suite once in Chromium**

The flag is now on for every e2e page, so check that the rest of the suite still passes. `a11y.spec.ts` and `presets.spec.ts` matter most, since they visit `/moje-filtry`.
Run: `pnpm test:e2e --project=chromium`
Expected: the same pass count as on `main`, plus 2.

- [ ] **Step 5: Pass the two vars in every build**

In `.github/workflows/ci.yml`, `deploy-dev.yml` and `deploy-prod.yml`, in the `env:` block of the build step, after `NEXT_PUBLIC_ROBOTS_NOINDEX`, add:

```yaml
          # Push reminders: off unless the environment's variable is 'true'.
          NEXT_PUBLIC_PUSH_ENABLED: ${{ vars.NEXT_PUBLIC_PUSH_ENABLED }}
          NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${{ vars.NEXT_PUBLIC_VAPID_PUBLIC_KEY }}
```

An unset variable reads as an empty string, so every environment stays off until Task 20 or 21 sets them.

- [ ] **Step 6: Document operations**

Append to `docs/DEPLOYMENT.md`:

```markdown
## Push reminders

Design: [docs/superpowers/specs/2026-11-05-scheduled-push-reminder-design.md](superpowers/specs/2026-11-05-scheduled-push-reminder-design.md).

### Changing when reminders go out

Supabase dashboard, hub project, **Table Editor**, schema `public` (prod) or
`dev`, table **`push_schedule`**. One row = one reminder a week:

| column | meaning |
| --- | --- |
| `weekday` | 1 = Monday … 7 = Sunday |
| `local_time` | the visitor's own wall-clock time, whole minutes (`12:00`) |
| `enabled` | untick to pause that day without deleting it |
| `note` | free text for you |

It applies at the next minute: no deploy. Each visitor gets it at that time
in their own timezone. A reminder runs up to 60 minutes late if the scheduler
was down, and is dropped after that.

### Moving parts

- `supabase/push/core.sql`: tables, functions, grants (`scripts/push-sql.sh <schema> <file>` renders it; `scripts/test-push-sql.sh` tests it locally in Docker).
- `supabase/push/seed.sql`: the starting schedule.
- `supabase/push/cron.sql`: `push_tick()` and the per-minute `pg_cron` job, one per schema (`push-tick-public`, `push-tick-dev`).
- Edge Function `push-send` (`supabase/functions/push-send/`), deployed with JWT verification **off**. Its secrets: `PUSH_CRON_SECRET`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SITE_URL_PUBLIC`, `SITE_URL_DEV`.
- Vault secrets read by `push_tick`: `push_send_url`, `push_cron_secret` (same value as the function's `PUSH_CRON_SECRET`).
- GitHub environment variables: `NEXT_PUBLIC_PUSH_ENABLED` (`true` to show the feature), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

### Turning it off

- Stop sending everywhere: in the SQL editor, `select cron.unschedule('push-tick-public');` (or untick every `push_schedule` row).
- Hide the UI: set `NEXT_PUBLIC_PUSH_ENABLED` to empty and redeploy. Existing subscribers stop getting reminders only once sending stops too.

### Is it working?

- `select jobname, status, return_message, start_time from cron.job_run_details join cron.job using (jobid) where jobname like 'push-tick-%' order by start_time desc limit 10;`
- Edge Function logs for `push-send`: one JSON line per run, `{schema, claimed, sent, gone, failed, recordFailed}`.
- `select count(*), count(*) filter (where failure_count > 0) from public.push_subscriptions;`
```

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/push-reminder.spec.ts .github/workflows docs/DEPLOYMENT.md
git commit -m "test(push): e2e for the card and bell; build vars; operations docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Full local check before anything goes live**

Run:
```bash
pnpm lint && pnpm type-check && pnpm test && scripts/test-push-sql.sh && deno test supabase/functions/push-send/handler.test.ts && pnpm build
```
Expected: all pass. `pnpm build` runs with the flag unset, and must produce a site with no card, because the default is off.

---

### Task 20: Live on dev (owner present)

This task changes the **`dev`** schema of the live hub project (`IdzNaMiasto`, ref `ondqwtwoepttupvhwlkx`).
- Get the owner's go-ahead before step 1.
- Secret VALUES are typed by the owner into dashboards. Never paste them into chat.

- [ ] **Step 1: Apply the core and the seed to `dev`**

1. Render the two files: `scripts/push-sql.sh dev supabase/push/core.sql` and `scripts/push-sql.sh dev supabase/push/seed.sql`.
2. Apply each one, either through the Supabase MCP `apply_migration` (names `push_reminder_core_dev` and `push_reminder_seed_dev`) or by pasting it into the SQL editor.

- [ ] **Step 2: Run the SQL tests against `dev`**

Paste the output of `scripts/push-sql.sh dev supabase/push/tests.sql` into the SQL editor, or run it with MCP `execute_sql`. Expected: no error. The file TRUNCATEs the tables but rolls back at the end, so the dev subscriptions survive.

- [ ] **Step 3: Check the advisors**

Run the Supabase security advisors (MCP `get_advisors`, type `security`). Expected: no new findings for `dev.push_*`. Two findings are worth knowing about:
- **"function search_path mutable"** must not appear, because every function sets `search_path`.
- **"RLS enabled no policy"** is intended: with no policy, anon has no direct access.

- [ ] **Step 4: Deploy the Edge Function**

Deploy `supabase/functions/push-send` as `push-send` with **verify_jwt = false**, via MCP `deploy_edge_function` or the dashboard. Include every `.ts` file except `handler.test.ts`.

The owner then sets the function secrets in Dashboard, Edge Functions, Secrets:
- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: from `~/.config/idznamiasto/vapid.env` (Task 5), opened in an editor.
- `SITE_URL_PUBLIC` = `https://idznamiasto.pl`
- `SITE_URL_DEV` = `https://aleksanderdudek.github.io/your-events`
- `PUSH_CRON_SECRET`: from step 5.

- [ ] **Step 5: Create the Vault secrets (owner, SQL editor)**

```sql
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_cron_secret');
select vault.create_secret('https://ondqwtwoepttupvhwlkx.supabase.co/functions/v1/push-send', 'push_send_url');
```

1. The owner reads the first value in the dashboard: `select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret';`
2. The owner pastes it as the function's `PUSH_CRON_SECRET`.

Both schemas share these Vault secrets, so create them only once.

- [ ] **Step 6: Schedule the tick for `dev`**

Apply `scripts/push-sql.sh dev supabase/push/cron.sql`.
Check: `select jobname, schedule from cron.job where jobname = 'push-tick-dev';` returns one row with `* * * * *`.

- [ ] **Step 7: Turn the UI on for the dev site**

```bash
gh variable set NEXT_PUBLIC_PUSH_ENABLED --env dev --body true -R AleksanderDudek/your-events
gh variable set NEXT_PUBLIC_VAPID_PUBLIC_KEY --env dev -R AleksanderDudek/your-events < <(sed -n 's/^VAPID_PUBLIC_KEY=//p' ~/.config/idznamiasto/vapid.env)
```

Merge `feat/push-reminder` into `main` only once the owner approves; the dev site deploys from `main`. After that deploy, `/your-events/moje-filtry/` shows the card.

- [ ] **Step 8: Device checklist on dev** (spec phase 0, step by step)

Run this on each of:
- **iPhone**: Safari, Add to Home Screen, then open from the icon.
- **Android Chrome**.
- **desktop Chrome**.

1. Switch reminders on. `select endpoint, tz from dev.push_subscriptions;` shows the device with the right timezone.
2. Add a dev schedule row three minutes ahead, in the device's local time: `insert into dev.push_schedule (weekday, local_time, note) values (extract(isodow from now() at time zone 'Europe/Warsaw'), date_trunc('minute', (now() at time zone 'Europe/Warsaw')::time) + interval '3 minutes', 'test');`
3. Within a minute of that time, the reminder "Idź na miasto / Zobacz, jakie są nowe wydarzenia w Twojej okolicy" arrives. Tapping it opens the dev home page.
4. Mark a filter with the bell, then move the test row 3 minutes ahead again. The reminder now carries the filter's name, and tapping it lands on that filter's list.
5. Turn reminders off and move the row ahead again. Nothing arrives, and `dev.push_subscriptions` has no row for the device.
6. iPhone only: check that the rewritten title (the filter name) appears, which proves the `mutable` path works. If iOS shows the generic payload instead, note it for the owner; the spec accepts this as the fallback.
7. Delete the test row: `delete from dev.push_schedule where note = 'test';`.

Record the results (pass or fail, per device, per step) in the PR or commit message.

---

### Task 21: Production (only after the owner says go)

- [ ] **Step 1:** Apply `core.sql` and `seed.sql` rendered for **`public`** (`apply_migration` names `push_reminder_core_public` and `push_reminder_seed_public`). Then run `tests.sql` for `public` in the SQL editor (it rolls back).
- [ ] **Step 2:** Apply `cron.sql` rendered for `public`. Check that `push-tick-public` exists.
- [ ] **Step 3:** Run `gh variable set NEXT_PUBLIC_PUSH_ENABLED --env prod --body true -R AleksanderDudek/your-events`, then set the VAPID public key on `prod` the same way as in Task 20, step 7.
- [ ] **Step 4:** Move `production` to the released commit as `docs/DEPLOYMENT.md` describes, and let `deploy-prod.yml` run.
- [ ] **Step 5:** On one device, switch reminders on at `https://idznamiasto.pl/moje-filtry/` and check that its row appears in `public.push_subscriptions`. The first real reminder goes out at the next Sunday, Tuesday or Thursday 12:00. Check `cron.job_run_details` and the `push-send` logs right after it.

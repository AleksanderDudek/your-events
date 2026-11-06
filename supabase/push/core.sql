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

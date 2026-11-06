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

-- The three accepted calls above really subscribed those devices; remove them
-- so later sections see only the warsaw/london fixtures.
delete from __SCHEMA__.push_subscriptions where endpoint in (
  'https://updates.push.services.mozilla.com/wpush/v2/x',
  'https://web.push.apple.com/x',
  'https://db5p.notify.windows.com/w/?token=x');

-- 6b. A bad time zone written directly is stored as Warsaw and breaks nothing.
do $$ begin
  insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth, tz)
    values ('https://fcm.googleapis.com/fcm/send/badtz', 'k', 'a', 'Nowhere/Bad');
  assert (select tz from __SCHEMA__.push_subscriptions where endpoint like '%/badtz') = 'Europe/Warsaw', 'bad tz fixed';
  perform pg_temp.due('2026-11-10 11:00+00');
  update __SCHEMA__.push_subscriptions set tz = 'Nowhere/Bad' where endpoint like '%/badtz';
  assert (select tz from __SCHEMA__.push_subscriptions where endpoint like '%/badtz') = 'Europe/Warsaw', 'bad tz on update fixed';
  perform pg_temp.due('2026-11-10 11:00+00');
  delete from __SCHEMA__.push_subscriptions where endpoint like '%/badtz';
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

  insert into __SCHEMA__.push_subscriptions (endpoint, p256dh, auth, created_at)
    values ('https://fcm.googleapis.com/fcm/send/never', 'k', 'a', '2026-08-01 00:00+00');
  perform __SCHEMA__.push_record('https://fcm.googleapis.com/fcm/send/never', 503, '2026-11-10 11:00+00');
  assert not exists (select 1 from __SCHEMA__.push_subscriptions where endpoint like '%/never'), 'never succeeded: created_at fallback deletes';
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
  assert not has_function_privilege('authenticated', '__SCHEMA__.push_claim_due(integer,timestamptz)', 'execute'), 'authenticated claim';
  assert not has_sequence_privilege('anon', '__SCHEMA__.push_schedule_id_seq', 'usage'), 'anon sequence';
  assert not has_table_privilege('anon', '__SCHEMA__.push_subscriptions', 'select'), 'anon table';
  assert not has_table_privilege('anon', '__SCHEMA__.push_schedule', 'select'), 'anon schedule';
end $$;

rollback;

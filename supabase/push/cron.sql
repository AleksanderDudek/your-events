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

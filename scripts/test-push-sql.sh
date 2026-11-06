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

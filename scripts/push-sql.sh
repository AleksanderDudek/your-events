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

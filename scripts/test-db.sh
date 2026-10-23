#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local Postgres and runs the security tests.
# Needs PostgreSQL installed locally (initdb, pg_ctl, psql); no Supabase account or Docker.
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
PORT=${TEST_DB_PORT:-54329}
initdb -D "$TMP/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
trap 'pg_ctl -D "$TMP/data" -m fast stop >/dev/null 2>&1; rm -rf "$TMP"' EXIT

PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f tests/db/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
echo "migrations applied: $(ls supabase/migrations/*.sql | wc -l | tr -d ' ')"
# Query results go to /dev/null; the tests report through notices and \echo.
"${PSQL[@]}" -o /dev/null -f tests/db/security.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
exit "${PIPESTATUS[0]}"

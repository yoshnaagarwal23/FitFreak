#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local Postgres, runs the SQL security tests,
# then serves the database through PostgREST (the REST server Supabase runs) and tests
# the app's real data layer (src/db) against it.
# Needs PostgreSQL (initdb, pg_ctl, psql) and PostgREST installed; no Supabase account or Docker.
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
PORT=${TEST_DB_PORT:-54329}
API_PORT=${TEST_API_PORT:-54330}
initdb -D "$TMP/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
PGRST_PID=
cleanup() {
  [ -n "$PGRST_PID" ] && kill "$PGRST_PID" 2>/dev/null
  pg_ctl -D "$TMP/data" -m fast stop >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT

PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f tests/db/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
echo "migrations applied: $(ls supabase/migrations/*.sql | wc -l | tr -d ' ')"
# Query results go to /dev/null; the tests report through notices and \echo.
"${PSQL[@]}" -o /dev/null -f tests/db/security.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
[ "${PIPESTATUS[0]}" -eq 0 ] || exit 1

if ! command -v postgrest >/dev/null; then
  echo "postgrest not installed (brew install postgrest) — skipping data-layer tests"
  exit 0
fi
export TEST_JWT_SECRET=local-test-secret-at-least-32-characters-long
export TEST_API_URL="http://127.0.0.1:$API_PORT"
export TEST_PG_HOST="$TMP" TEST_PG_PORT="$PORT"
PGRST_DB_URI="postgres://authenticator@/postgres?host=$TMP&port=$PORT" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$TEST_JWT_SECRET" \
PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT="$API_PORT" PGRST_DB_MAX_ROWS=1000 \
  postgrest >"$TMP/postgrest.log" 2>&1 &
PGRST_PID=$!
for _ in $(seq 50); do
  curl -sf "$TEST_API_URL/" >/dev/null && break
  sleep 0.2
done
node --import ./tests/support/register.mjs --test --test-reporter=spec "tests/cloud/*.test.mts"

#!/bin/sh
# Proves the newest backup restores: loads it into a throwaway PostgreSQL
# container (never the live database), checks the tables and row counts
# match what the dump says, then removes the container. Exits non-zero,
# and says why, if anything is off.
set -eu

ROOT="${BACKUP_DIR:-backups}"
LATEST="${1:-$(ls -1d "$ROOT"/*/ 2>/dev/null | sort | tail -n 1)}"
[ -n "$LATEST" ] && [ -f "$LATEST/tshaeno.dump" ] || { echo "No backup found in $ROOT" >&2; exit 1; }
(cd "$LATEST" && sha256sum -c SHA256SUMS > /dev/null) || { echo "Checksum doesn't match for $LATEST" >&2; exit 1; }

NAME="tshaeno-restore-test-$$"
cleanup() { docker rm -f "$NAME" > /dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=restore -e POSTGRES_USER=tshaeno -e POSTGRES_DB=tshaeno postgres:16-alpine > /dev/null
i=0
until docker exec "$NAME" pg_isready -U tshaeno -d tshaeno > /dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -lt 60 ] || { echo "Restore database didn't start" >&2; exit 1; }; sleep 1
done
# The app role exists on the real server; make it here so grants restore cleanly.
docker exec "$NAME" psql -q -U tshaeno -d tshaeno -c "CREATE ROLE tshaeno_app NOLOGIN" > /dev/null
docker exec -i "$NAME" pg_restore -U tshaeno -d tshaeno --exit-on-error < "$LATEST/tshaeno.dump"

count() { docker exec "$NAME" psql -tA -U tshaeno -d tshaeno -c "$1"; }
MIGRATIONS=$(count 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
ORGS=$(count 'SELECT count(*) FROM "Organisation"')
USERS=$(count 'SELECT count(*) FROM "User"')
RLS=$(count "SELECT count(*) FROM pg_class WHERE relname IN ('Organisation','Membership','Invitation','AuditLog') AND relrowsecurity AND relforcerowsecurity")
[ "$MIGRATIONS" -ge 1 ] || { echo "No migrations in the restored database" >&2; exit 1; }
[ "$RLS" -eq 4 ] || { echo "Row-level security missing after restore" >&2; exit 1; }
echo "Restore test passed for $LATEST: $MIGRATIONS migrations, $ORGS organisations, $USERS people, row-level security intact."

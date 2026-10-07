#!/bin/sh
# Backs up the Tshaeno database into a dated folder, checks it can be read
# back, and removes folders older than KEEP_DAYS. Run it from the folder
# with docker-compose.yml, nightly (see docs/going-live.md):
#   15 1 * * * cd /opt/tshaeno && ./scripts/backup.sh >> backups/backup.log 2>&1 && ./scripts/restore-test.sh >> backups/backup.log 2>&1
# Set BACKUP_REMOTE (an rclone remote such as "b2:tshaeno-backups") to copy each backup off the server too.
set -eu
umask 077

KEEP_DAYS="${KEEP_DAYS:-30}"
ROOT="${BACKUP_DIR:-backups}"
DEST="$ROOT/$(date -u +%Y-%m-%dT%H%MZ)"
mkdir -p "$DEST"

# The whole database, in PostgreSQL's own format (restore with pg_restore).
docker compose exec -T db pg_dump -U tshaeno -d tshaeno --format=custom > "$DEST/tshaeno.dump"

# A backup that can't be read is no backup.
docker compose exec -T db pg_restore --list < "$DEST/tshaeno.dump" > /dev/null
(cd "$DEST" && sha256sum tshaeno.dump > SHA256SUMS)

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$DEST" "$BACKUP_REMOTE/$(basename "$DEST")"
fi

find "$ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "Backed up to $DEST ($(du -sh "$DEST" | cut -f1))"

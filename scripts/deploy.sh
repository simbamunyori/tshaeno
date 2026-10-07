#!/bin/sh
# Deploys one exact image version on this server and rolls back by itself
# if it doesn't come up healthy. Run from /opt/tshaeno (the GitHub
# deploy workflow does this over SSH):
#   ./scripts/deploy.sh ghcr.io/simbamunyori/tshaeno:<commit>
#
# Migrations run before the new version starts and are not undone by a
# rollback, so every migration must keep working with the version before
# it (add columns and tables first; remove them in a later release).
set -eu

NEW="$1"
STATE=.deployed-image
PREVIOUS="$(cat "$STATE" 2>/dev/null || true)"
DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2- || true)"
HEALTH_URL="${HEALTH_URL:-https://${DOMAIN:-localhost}/api/health}"

if [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then
  echo "Backing up before deploying $NEW"
  ./scripts/backup.sh
fi

start() {
  export TSHAENO_IMAGE="$1"
  docker compose pull migrate app worker
  docker compose up -d --wait db redis
  docker compose run --rm migrate
  docker compose up -d --no-build --no-deps --wait app worker
  docker compose up -d caddy
}

healthy() {
  i=0
  while [ "$i" -lt 30 ]; do
    if curl -fsS --max-time 5 "$HEALTH_URL" > /dev/null 2>&1; then return 0; fi
    i=$((i + 1)); sleep 2
  done
  return 1
}

if start "$NEW" && healthy; then
  echo "$NEW" > "$STATE"
  echo "Deployed $NEW"
  docker image prune -f > /dev/null
  exit 0
fi

echo "Deploy of $NEW failed its health check." >&2
if [ -n "$PREVIOUS" ]; then
  echo "Rolling back to $PREVIOUS" >&2
  start "$PREVIOUS" && healthy && echo "Rolled back to $PREVIOUS" >&2
fi
exit 1

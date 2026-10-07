#!/bin/sh
# web (default): the Next.js server. worker: background jobs.
# migrate: apply database migrations as the owner role, then exit.
set -e
case "${1:-web}" in
  web) exec node server.js ;;
  worker) exec node worker.mjs ;;
  migrate) DATABASE_URL="$MIGRATE_DATABASE_URL" exec node node_modules/prisma/build/index.js migrate deploy ;;
  *) exec "$@" ;;
esac

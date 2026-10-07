#!/bin/sh
# Runs once, when the database volume is first created. Makes the role
# the app connects as: it can log in, owns nothing and is subject to
# row-level security. Migrations grant it access to the tables.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE tshaeno_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
SQL

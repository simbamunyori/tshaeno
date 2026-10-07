# Tshaeno

Email signatures for every person in an organisation, from 2 people to
10,000, managed in one place and applied in Gmail and Outlook. Sold
directly and through the Fourth Generation Technologies marketplace.

[docs/build-plan.md](docs/build-plan.md) is the plan: milestones S1 to S7
and the order signatures are applied in. [docs/architecture.md](docs/architecture.md)
is the rules the code enforces. [brand/](brand/) is the brand pack.

## Run it locally

You need Node 22, PostgreSQL 16 and Redis 7.

```sh
cp .env.example .env        # set TOTP_ENCRYPTION_KEY: openssl rand -base64 32
psql -U postgres -c "CREATE ROLE tshaeno LOGIN PASSWORD 'change-me' CREATEDB"
psql -U postgres -c "CREATE ROLE tshaeno_app LOGIN PASSWORD 'change-me-too'"
psql -U postgres -c "CREATE DATABASE tshaeno OWNER tshaeno"
npm install
npm run db:migrate          # as the owner role, from MIGRATE_DATABASE_URL
npm run dev                 # http://localhost:3000
npm run worker              # in another terminal: sends email
```

Without `SMTP_URL`, emails are printed by the worker so you can follow
their links.

`npm run check` runs lint, type checks and tests. The database tests,
including the tenant isolation tests, run when `DATABASE_URL` points at a
migrated database as the `tshaeno_app` role, and are skipped otherwise.

## Run it on a server

```sh
cp .env.example .env        # fill it in; see docs/going-live.md
docker compose up -d --build
```

[docs/going-live.md](docs/going-live.md) walks through the whole set-up:
the server, automatic deploys with rollback, nightly backups with a
restore test, and sign-in with Google and Microsoft.

## Layout

| Path | What lives there |
| --- | --- |
| `prisma/` | Data model and migrations, including row-level security and the append-only audit log |
| `src/server/db.ts` | The database client and `asTenant`, `asUser`, `asSystem` |
| `src/server/auth/` | Passwords, authenticator codes, passkeys, Google and Microsoft sign-in, sessions |
| `src/server/org/` | Roles, team, audit log |
| `src/server/platform/` | The staff-only platform admin area |
| `src/server/mail/`, `src/server/jobs/`, `src/worker.ts` | Email and background jobs |
| `src/app/` | Pages and API routes |
| `brand/` | Logo, colours, type, icons |
| `scripts/` | Deploy with rollback, backup, restore test |

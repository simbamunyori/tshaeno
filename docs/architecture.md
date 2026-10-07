# Architecture and invariants

These rules are the product's promises. Each one is enforced in code and,
where it matters most, by the database itself.

## Processes

| Process | What it does | Where |
| --- | --- | --- |
| `app` | The Next.js web app and its API routes | `src/app`, `src/server` |
| `worker` | Background jobs on BullMQ: sending email, nightly tidy-up | `src/worker.ts`, `src/server/jobs` |
| `migrate` | Applies database migrations as the owner role, then exits | `prisma/migrations` |
| `db`, `redis`, `caddy` | PostgreSQL 16, Redis 7, HTTPS | `docker-compose.yml` |

All three of ours are the same image with a different command, so
anything that runs containers can run Tshaeno. Several copies of `app`
and `worker` can run at once: every job claims its rows in the database
first.

## Tenancy

Every organisation is a tenant. Every row of tenant data carries
`organisationId`, and PostgreSQL row-level security decides what a query
can see and write, not the application code.

- The app connects as `tshaeno_app`. That role owns no tables, is not a
  superuser and cannot bypass row-level security. Migrations run as a
  separate owner role.
- Every tenant table has `ENABLE` and `FORCE ROW LEVEL SECURITY` with a
  policy on `organisationId` (first migration).
- Code says whose data it is working on by opening a transaction with
  `asTenant(organisationId, tx => ...)` in `src/server/db.ts`. That sets
  `app.org_id` for that transaction only (`set_config(..., true)`), so a
  pooled connection never carries one request's tenant into the next.
- `asUser(userId, ...)` can read only that person's own memberships and
  the names of their organisations, for the organisation switcher.
- `asSystem(...)` sees across organisations. It is used for sign-up,
  accepting an invitation, the worker and the platform admin area, and
  nothing else.
- With no scope set, a query sees no tenant rows at all.

`tests/tenant-isolation.test.ts` runs as the app role and proves: the
role can't bypass security; every table with an `organisationId` column
is protected (so a new table without a policy fails the build); nothing
is visible without a scope; one organisation can't read, write, update,
delete or move rows into another; scope never leaks between
transactions; and the audit log stays append-only.

People, sessions and sign-in methods are global (one person, one
sign-in, any number of organisations), so those tables have no tenant
policy.

## Roles

| Role | Can |
| --- | --- |
| Owner | Everything, including billing and other owners |
| Admin | Everything except billing and owners |
| Template manager | Signature templates, brand kits and rules |
| Analyst | Coverage and analytics |
| Read-only | Sees everything, changes nothing |

The matrix is `src/server/org/access.ts`. An organisation always keeps at
least one owner. Only owners can make, change or remove owners. Removing
someone ends their sessions in that organisation at once.

## Sign-in

- **Email and password** always needs a second step: an authenticator
  app, set up straight after the password the first time. Passwords are
  scrypt (N=2^17), at least 12 characters. Five wrong passwords or codes
  in a row pause sign-in for 15 minutes; a wrong email and a wrong
  password get the same answer and take as long.
- **Google and Microsoft** use OpenID Connect with PKCE, state and nonce;
  the id_token's signature, issuer, audience, expiry and nonce are all
  checked (`src/server/auth/oidc.ts`). When the person has an
  authenticator set up, it is asked for too.
- A new Google sign-in joins the account with the same email only when
  Google says the email is verified. **A Microsoft sign-in never joins an
  existing account by email**, because an Entra admin can put any address
  on an account; people link Microsoft from Your security once signed
  in. For Microsoft the stable id is the tenant id plus the object id.
- **Passkeys** (WebAuthn, user verification required) sign in fully on
  their own: the device and its lock are two factors. Each challenge is
  stored once for five minutes and deleted when used.
- Nobody can remove their last way to sign in.
- The authenticator secret is encrypted with AES-256-GCM using
  `TOTP_ENCRYPTION_KEY`. Each code works once. Ten single-use backup
  codes are shown once and stored hashed.
- Session cookies hold a random token; only its SHA-256 hash is stored.
  The token is replaced when sign-in completes. Sessions end after 12
  hours without activity and 7 days at most.
- Links in emails (invitations, confirming an email) store only a hash,
  are made when the email is sent, and only the newest one works.
  Opening a link only shows a page; acting on it takes a press, so mail
  scanners can't use links up.

## Audit log

Every change inside an organisation writes an `AuditLog` row in the same
transaction. Triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on it.
Members with Owner, Admin or Read-only can read it under Audit log.

## Platform admin

`/admin` is for Tshaeno staff (`User.isPlatformAdmin`, set by hand on the
server, never from the app; everyone else gets "not found"). Staff can
search organisations, open one, and suspend or resume it with a reason.
Every search, every organisation opened and every change is written to
`PlatformAuditLog` (append-only), and suspensions also go into the
organisation's own audit log as "Tshaeno staff: name".

A suspended organisation can't be opened by its members; nothing is
deleted.

## Email

Email goes through the `OutboundEmail` table, written in the same
transaction as the change that causes it. The app nudges the worker
through BullMQ; the worker also checks every 30 seconds. It claims rows
with `FOR UPDATE SKIP LOCKED` and a lease, renders them at send time (so
links are never stored), and retries up to five times. Without
`SMTP_URL`, development prints emails to the log and production refuses
to send.

## Secrets

Secrets come only from environment variables (see `.env.example`) and
are validated at start-up by `src/server/env.ts`.

## Deploying and backups

See [going-live.md](going-live.md). In short: merging to `main` runs CI;
when it passes, one image is built and tagged with the commit, deployed
to staging and then production by `scripts/deploy.sh`, which backs up
first and rolls back to the previous image by itself if the new one
isn't healthy. Migrations are not undone by a rollback, so each one must
work with the version before it (add first, remove in a later release).
Backups run nightly and each one is restored into a throwaway database
to prove it works.

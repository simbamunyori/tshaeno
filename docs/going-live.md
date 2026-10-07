# Going live

Every step is an exact command or click. You need a Linux server (Ubuntu
24.04, 2 CPUs and 4 GB is plenty to start) with a public IP, and a domain.
Repeat steps 1 to 5 for a second server if you want staging and
production apart; one server can be both while you start.

## 1. Point the domain at the server

At your DNS provider, add an `A` record for `app.tshaeno.com` (or your
chosen name) with the server's IP address.

## 2. Install Docker and get the code

```sh
ssh root@YOUR-SERVER
curl -fsSL https://get.docker.com | sh
apt-get install -y git rclone
git clone https://github.com/simbamunyori/tshaeno.git /opt/tshaeno
cd /opt/tshaeno
```

## 3. Fill in the settings

```sh
cp .env.example .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
sed -i "s|^APP_DB_PASSWORD=.*|APP_DB_PASSWORD=$(openssl rand -hex 24)|" .env
sed -i "s|^TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=$(openssl rand -base64 32)|" .env
nano .env
```

In `nano`, set `APP_URL=https://app.tshaeno.com`, `DOMAIN=app.tshaeno.com`,
`SMTP_URL` and `MAIL_FROM`. Save with Ctrl+O, Enter, then Ctrl+X.

Copy `TOTP_ENCRYPTION_KEY` into your password manager. If it is lost,
everyone has to set up their authenticator app again.

## 4. Let the server pull images

The deploy workflow publishes images to GitHub's registry. On github.com,
click your profile picture, **Settings**, **Developer settings**,
**Personal access tokens**, **Tokens (classic)**, **Generate new token
(classic)**. Tick only `read:packages`, then **Generate token**. On the
server:

```sh
echo YOUR-TOKEN | docker login ghcr.io -u simbamunyori --password-stdin
```

## 5. First start

Until the first deploy has run, build on the server once:

```sh
cd /opt/tshaeno
docker compose up -d --build
docker compose ps
curl -fsS https://app.tshaeno.com/api/health
```

The last command prints `{"ok":true,...}`. Open the site and sign up: the
first organisation is yours.

**Make yourself staff** (opens Platform admin), with your sign-in email:

```sh
docker compose exec -T db psql -U tshaeno -d tshaeno \
  -c "UPDATE \"User\" SET \"isPlatformAdmin\" = true WHERE email = 'you@example.com'"
```

## 6. Automatic deploys

On github.com, open the `tshaeno` repository, then **Settings**,
**Environments**, **New environment**, name it `staging`, **Configure
environment**. Under **Environment secrets**, **Add environment secret**
four times:

| Name | Value |
| --- | --- |
| `DEPLOY_HOST` | The server's address, e.g. `app.tshaeno.com` |
| `DEPLOY_USER` | `root`, or a user in the `docker` group |
| `DEPLOY_SSH_KEY` | A private key whose public half is in that user's `~/.ssh/authorized_keys` |
| `DEPLOY_KNOWN_HOSTS` | The output of `ssh-keyscan app.tshaeno.com` |

Make the key on your own computer with `ssh-keygen -t ed25519 -f tshaeno-deploy -N ""`,
paste `tshaeno-deploy` into `DEPLOY_SSH_KEY`, and add `tshaeno-deploy.pub`
to the server with `ssh-copy-id -i tshaeno-deploy.pub root@app.tshaeno.com`.

Then do the same for a `production` environment. On it, tick **Required
reviewers** and add yourself if you want to approve each production
deploy; leave it unticked for fully automatic deploys.

From then on, every merge to `main` that passes CI is deployed to staging,
then production. `scripts/deploy.sh` backs up first, starts the new
version and checks `/api/health` for a minute. If it isn't healthy, it
puts the previous version back by itself and the workflow fails, so you
see it.

**Roll back by hand** to any earlier version:

```sh
cd /opt/tshaeno
./scripts/deploy.sh ghcr.io/simbamunyori/tshaeno:COMMIT
```

`COMMIT` is the first 12 characters of the commit, as shown in the Deploy
workflow's summary.

## 7. Nightly backups, each one tested

```sh
mkdir -p /opt/tshaeno/backups
crontab -e
```

Add this line, then save:

```
15 1 * * * cd /opt/tshaeno && ./scripts/backup.sh >> backups/backup.log 2>&1 && ./scripts/restore-test.sh >> backups/backup.log 2>&1
```

Every night at 01:15 the database is saved, then restored into a
throwaway database to prove it works. `tail backups/backup.log` shows
"Restore test passed" each morning.

A backup on the same server doesn't survive losing the server. To copy
each one off it, run `rclone config` once to add storage (for example
Backblaze B2 or Google Drive), then add `BACKUP_REMOTE=yourremote:tshaeno-backups`
to the start of the cron line.

**Restoring** onto a new server set up as in steps 2 to 4 with the same `.env`:

```sh
cd /opt/tshaeno
docker compose up -d db
docker compose exec -T db pg_restore -U tshaeno -d tshaeno --clean --if-exists < backups/FOLDER/tshaeno.dump
docker compose up -d
```

## 8. Sign in with Google and Microsoft (optional)

Each button appears once its two settings are in `.env`; run
`docker compose up -d` after changing it.

**Google.** Open console.cloud.google.com, pick or create a project,
then **APIs and services**, **OAuth consent screen**: External, app name
Tshaeno, your support email, **Save**. Then **Credentials**, **Create
credentials**, **OAuth client ID**, type **Web application**, under
**Authorised redirect URIs** add `https://app.tshaeno.com/auth/google/callback`,
**Create**. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`.

**Microsoft.** Open entra.microsoft.com, **Applications**, **App
registrations**, **New registration**. Name Tshaeno; supported account
types **Accounts in any organizational directory and personal Microsoft
accounts**; redirect URI platform **Web**,
`https://app.tshaeno.com/auth/microsoft/callback`; **Register**. Copy the
**Application (client) ID** into `MICROSOFT_CLIENT_ID`. Then
**Certificates and secrets**, **New client secret**, **Add**, and copy the
secret's **Value** into `MICROSOFT_CLIENT_SECRET`. Put a reminder in your
calendar for when the secret expires.

## 9. Connecting customers' Google Workspace and Microsoft 365 (optional)

Customers connect from **Connections** in the app. Until these settings
are in `.env`, that page says the server isn't set up yet. Run
`docker compose up -d` after changing it.

**Google Workspace.** In console.cloud.google.com, in the same project
or a new one: **APIs and services**, **Enable APIs**, and enable the
**Admin SDK API** and the **Gmail API**. Then **IAM and admin**, **Service
accounts**, **Create service account**, name it tshaeno-directory, no
roles, **Done**. Open it, **Keys**, **Add key**, **JSON**. Paste the
downloaded file's whole contents into `GOOGLE_SERVICE_ACCOUNT_KEY` (or
`base64 -w0` it first), then delete the file. The service account's
**Unique ID** is the client ID customers paste into their Admin console;
the Connections page shows it with the scopes, so there is nothing to
send them.

**Microsoft 365.** Either give the sign-in app from step 8 the extra
permissions, or register a second app the same way (accounts in any
organizational directory). Under **Authentication**, add the Web redirect
URI `https://app.tshaeno.com/connect/microsoft/callback`. Under **API
permissions**, **Add a permission**, **Microsoft Graph**, **Application
permissions**, and add **User.Read.All** and **GroupMember.Read.All**.
Don't grant consent for your own tenant unless you want to connect it;
each customer's admin grants it from the consent link. For a separate
app, fill in `MICROSOFT_DIRECTORY_CLIENT_ID` and
`MICROSOFT_DIRECTORY_CLIENT_SECRET`.

**Outlook add-in.** Nothing to set up on the server. Each customer
downloads their own manifest from Connections and deploys it from the
Microsoft 365 admin centre. The add-in loads from this server, so it must
be reachable over https at `APP_URL`.

## 10. Taking payments

Until DPO Pay is set up, customers choose a plan, get an invoice with your
bank details and pay by transfer. When the money arrives, open the
organisation in the admin area, find the invoice under Plan and billing and
click Record payment. Their plan starts from that day.

1. In `.env`, set `BANK_DETAILS`, `INVOICE_ISSUER` (your registered name and
   address) and, if you charge VAT, `TAX_PERCENT` and `TAX_LABEL`.
2. Set `SALES_EMAIL` to the address that should get Enterprise quote requests.
3. When your DPO merchant account is approved, copy the company token and
   service type into `DPO_COMPANY_TOKEN` and `DPO_SERVICE_TYPE`, then run
   `docker compose up -d`. A Pay online button appears on every open invoice.
   Payments are checked against DPO when the customer returns and again every
   hour, so a closed browser tab doesn't lose a payment.
4. Prices are in the admin area under Prices, per plan and currency.

## 11. Selling through Fourth Generation (optional)

**The partner API.** In the admin area, open **Partners**, enter
`Fourth Generation Technologies` and click **Add partner**. Copy the key and
secret and give them to Fourth Generation over a secure channel; the secret
isn't shown again. On the partner's page, add the addresses their console
calls from and their wholesale discount. Everything they need is in
`docs/partner-api.md`.

**Signing in from the console.** The Fourth Generation console is an OpenID
Connect provider. In the console's admin area, register a new client:

- Client type: **confidential**, with the **authorization code** flow and
  **PKCE (S256)**.
- Redirect URI: `https://YOUR-DOMAIN/auth/fourthgen/callback`
- Scopes: `openid email profile`. The ID token must include `email` and
  `email_verified`.

Then put the console's issuer address (the one that serves
`/.well-known/openid-configuration`) and the client's id and secret in
`.env` as `FOURTHGEN_OIDC_ISSUER`, `FOURTHGEN_CLIENT_ID` and
`FOURTHGEN_CLIENT_SECRET`, and run `docker compose up -d`. A **Continue with
Fourth Generation** button appears on the sign-in page.

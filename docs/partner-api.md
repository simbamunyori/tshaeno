# Tshaeno partner API

For partners such as Fourth Generation Technologies, who sell Tshaeno to their own customers and bill them. Through the API, a partner can:

- set up an organisation for a customer
- change its plan and the number of people it pays for
- pause, resume or cancel it
- read the usage it bills on

Partners never see an organisation's people, addresses or signatures.

Tshaeno bills the partner at its wholesale price. The partner bills the customer. Organisations set up this way get no invoices from Tshaeno, have no trial, and never show the "Signature by Tshaeno" link. Their admins see "Fourth Generation bills you for Tshaeno" under Plan and billing, and can't change the plan themselves.

The API is built the same way as Thebe's partner API, so one adapter in the partner's console serves both. Only the base address and the header prefix (`X-Tshaeno-` instead of `X-Thebe-`) differ, and the plan names and usage fields are Tshaeno's own.

Base URL: `https://YOUR-DOMAIN/api/partner/v1`

## Getting a key

A Tshaeno staff member adds the partner in the admin area: **Partners, Add partner**.

- They're shown a key (`pk_…`) and a secret (`ps_…`). The secret is shown only once, so it must be passed to the partner over a secure channel.
- On the partner's page, staff can limit calls to the partner's IP addresses, set its wholesale discount, or turn the key off.
- **New secret** makes a new secret, and the old one stops working at once.

## Signing every request

Send these headers with every request:

| Header | Value |
| --- | --- |
| `X-Tshaeno-Key` | Your key, `pk_…` |
| `X-Tshaeno-Timestamp` | The current time in seconds since 1970. It must be within 5 minutes of Tshaeno's clock. |
| `X-Tshaeno-Signature` | `v1=` followed by the hex HMAC-SHA256 of the string below, keyed with your secret |
| `Idempotency-Key` | Required on every POST and PATCH. Use a value that is unique to the change, such as your own order id. |
| `Content-Type` | `application/json` |

The signed string is four lines joined by `\n`:

```
<timestamp>
<METHOD>
<path with query, e.g. /api/partner/v1/organisations/cust-42>
<hex SHA-256 of the exact body bytes; of the empty string when there's no body>
```

In Node:

```js
import { createHash, createHmac } from "node:crypto";

function headers(method, path, body, key, secret) {
  const ts = String(Math.floor(Date.now() / 1000));
  const hash = createHash("sha256").update(body).digest("hex");
  const sig = createHmac("sha256", secret).update([ts, method, path, hash].join("\n")).digest("hex");
  return { "X-Tshaeno-Key": key, "X-Tshaeno-Timestamp": ts, "X-Tshaeno-Signature": `v1=${sig}`, "Content-Type": "application/json" };
}
```

With curl, using bash and openssl:

```bash
BODY='{"reference":"cust-42","name":"Kgale Hill Traders","seats":20,"currency":"BWP","owner":{"name":"Tumelo Sello","email":"tumelo@kgale.co.bw"}}'
PATH_Q=/api/partner/v1/organisations
TS=$(date +%s)
HASH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $NF}')
SIG=$(printf '%s\n%s\n%s\n%s' "$TS" POST "$PATH_Q" "$HASH" | openssl dgst -sha256 -hmac "$TSHAENO_SECRET" -hex | awk '{print $NF}')
curl -sS "https://YOUR-DOMAIN$PATH_Q" -X POST -H "Content-Type: application/json" \
  -H "X-Tshaeno-Key: $TSHAENO_KEY" -H "X-Tshaeno-Timestamp: $TS" -H "X-Tshaeno-Signature: v1=$SIG" \
  -H "Idempotency-Key: order-1001" --data "$BODY"
```

## Retries

If a change times out, send it again with the same `Idempotency-Key`. Tshaeno returns the first answer and doesn't make the change twice. A replayed answer carries the header `Idempotent-Replayed: true`.

Two cases are different:

- If you reuse a key with a different method, path or body, the answer is `422 idempotency_key_reused`.
- A `500` isn't stored, so a retry with the same key runs the change again.

## Errors

Every error looks like this:

```json
{ "error": { "code": "too_few_seats", "message": "This organisation has 23 people in its directory, more than 20 seats.", "details": { "people": 23 } } }
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `idempotency_key_required`, `invalid_json` | Fix the request. |
| 401 | `unauthorised`, `stale`, `bad_signature` | The key is unknown or turned off, the clock is off, or the signature is wrong. |
| 403 | `address_not_allowed` | The call came from an address that isn't on your list. |
| 404 | `not_found` | You have no organisation with that reference. |
| 409 | `exists`, `too_few_seats`, `suspended_by_tshaeno` | The change conflicts with how things are now. |
| 422 | `invalid`, `idempotency_key_reused` | The fields are wrong; `details` lists each one. |
| 500 | `server_error` | Retry with the same Idempotency-Key. |

## Plans

Tshaeno is priced per person per month, in bands:

| `plan` | For |
| --- | --- |
| `STARTER` | 2 to 15 people |
| `GROWTH` | 16 to 100 people |
| `BUSINESS` | 101 to 999 people |
| `ENTERPRISE` | 1,000 people or more |

A person is someone in the organisation's directory, usually synced from Google Workspace or Microsoft 365, whether or not they ever sign in to Tshaeno.

## Endpoints

`{reference}` is your own id for the customer, the one you sent when you set it up.

### Set up an organisation

`POST /organisations`

```json
{
  "reference": "cust-42",
  "name": "Kgale Hill Traders",
  "plan": "GROWTH",
  "seats": 20,
  "currency": "BWP",
  "owner": { "name": "Tumelo Sello", "email": "tumelo@kgale.co.bw" }
}
```

- `seats` is the number of people the customer pays you for.
- `plan` is optional. Leave it out and Tshaeno picks the band that fits `seats`.
- `currency` is `BWP`, `ZAR` or `USD`, and defaults to `BWP`.

The owner is emailed an invitation, valid for 7 days. They choose a password and set up an authenticator app. If they sign in to Tshaeno from the Fourth Generation console with the same address instead, they join straight away; see "Single sign-on" below.

The answer is `201`, with an organisation:

```json
{
  "reference": "cust-42",
  "id": "cm…",
  "name": "Kgale Hill Traders",
  "plan": "GROWTH",
  "seats": 20,
  "currency": "BWP",
  "status": "active",
  "suspendedBy": null,
  "createdAt": "2026-10-09T09:00:00.000Z"
}
```

`status` is `active`, `suspended` or `cancelled`. `suspendedBy` is `partner`, `tshaeno` or `null`.

### Read one

`GET /organisations/{reference}`

### Change the plan, seats or name

`PATCH /organisations/{reference}` with any of `{ "plan": "BUSINESS", "seats": 120, "name": "…" }`.

The change takes effect at once. Fewer seats than people already in the directory is refused with `409 too_few_seats`, and `details.people` says how many there are.

### Pause and resume

- `POST /organisations/{reference}/suspend` with an optional `{ "reason": "Unpaid bill" }`. Nobody can sign in to the organisation, and its members see the reason. The directory stops syncing and no new signatures are applied. Nothing is deleted.
- `POST /organisations/{reference}/resume` lifts your pause, or brings back a cancelled organisation.

You can't lift a pause that Tshaeno put in place: that answer is `409 suspended_by_tshaeno`.

### Cancel

`POST /organisations/{reference}/cancel` with an optional `{ "reason": "…" }`.

After cancelling, people can still sign in and look, but the directory stops syncing, the Outlook add-in stops adding signatures, and Gmail signatures are no longer updated. Signatures already set in Gmail stay until someone changes them. `resume` undoes a cancellation.

### Usage

`GET /organisations/{reference}/usage`

```json
{
  "reference": "cust-42",
  "plan": "GROWTH",
  "seats": 20,
  "people": 18,
  "admins": 2,
  "connected": [{ "provider": "google_workspace", "status": "connected" }],
  "outlookAddIn": false,
  "peopleWithSignature": 17,
  "firstSignatureAt": "2026-10-09T09:14:02.000Z",
  "changesLast30Days": 41,
  "lastActivityAt": "2026-10-09T14:58:12.000Z"
}
```

- `people` is the number of active people in the directory, which is what seats cover.
- `admins` is the number of people who can sign in to Tshaeno.
- `peopleWithSignature` counts people whose signature Tshaeno has applied in Gmail or Outlook.

### Prices

`GET /prices` returns Tshaeno's retail price per person per month for every plan and currency, billed monthly and billed yearly, and your wholesale price after your discount. Amounts are in minor units (thebe or cents), written as strings.

```json
{
  "wholesaleDiscountPercent": 20,
  "prices": [
    { "plan": "STARTER", "currency": "BWP", "retail": { "monthly": "2000", "annual": "1667" }, "wholesale": { "monthly": "1600", "annual": "1334" } }
  ]
}
```

## Single sign-on

Customers can sign in to Tshaeno from the Fourth Generation console. The console is an OpenID Connect provider; setting it up is in `docs/going-live.md`, step 11.

- Link the console's Tshaeno tile to `https://YOUR-DOMAIN/auth/fourthgen`. A person who isn't signed in to Tshaeno is sent to the console, and comes back signed in.
- The console's ID token must carry `email` and `email_verified: true`. Tshaeno then matches the person by that address the first time, and by the console's `sub` after that.
- A person with a waiting invitation, such as the owner named when the organisation was set up, joins that organisation as soon as they arrive this way.
- People with a Tshaeno account can also link the console under **Settings, Your security**.
- Everyone still sets up an authenticator app on their first visit.

## What Tshaeno records

Every call that carries a known key is logged, and the log can't be changed. Each entry records:

- the method and path
- a hash of the body
- the caller's address
- the status and the answer

Staff see the latest calls on the partner's page. Every change also goes into the organisation's own activity log, under the partner's name.

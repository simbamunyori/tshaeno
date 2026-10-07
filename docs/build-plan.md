# Tshaeno: build plan

Tshaeno is our email signature platform for organisations from 2 users to 10,000+. The full product blueprint is in docs/blueprint.md (positioning, packaging, features, journeys, roadmap). This document says how to build it. Where the two differ, this file wins.

Tshaeno is a standalone SaaS with its own website, sign-up and billing, and it is also sold through the Fourth Generation Technologies marketplace, exactly like Thebe: subscribing there creates the customer's Tshaeno organisation automatically and bills them on the Fourth Generation invoice.

Tshaeno replaces the planned "Fourth Generation Signatures". Fourth Generation email customers get Tshaeno's Starter plan free through the marketplace.

## Working rules

- New repository, `tshaeno`. One PR per milestone, all checks green before review, automatic deploy on merge with rollback, nightly backups with a tested restore. Hand steps as exact clicks or commands.
- Same stack as our other products so one small team can run them all: Next.js and TypeScript, PostgreSQL with row-level security per tenant, Redis, a job queue (BullMQ), Docker Compose, deployed by GitHub Actions. Not Kubernetes or a second cloud yet; keep the code container-ready so it can move later.
- Multi-tenant from day one, with isolation enforced in the database and tested.
- Design: its own brand (deep navy and teal with one sharp accent, neutral greys, strong type), the same quality bar as the Fourth Generation site, light and dark, phone first. Brand assets are produced in milestone S1.
- Copy: plain, confident, no exclamation marks, no em dashes.

## Important: how signatures are applied, and in what order

The blueprint's phase 1 puts Microsoft 365 server-side imprinting first. That means every customer email passes through our servers before delivery. If our service is down or slow, customers' email is delayed or stuck. That needs high availability (several servers, queues, monitoring) from the first customer, which we have deliberately deferred.

So the build order is:

1. **Phase A, no mail flow through us.** Signatures are applied without touching email delivery:
   - Google Workspace: push each user's signature directly through the Gmail API (send-as settings). Works on every device for web and mobile Gmail.
   - Microsoft 365: the Outlook add-in (web, desktop, Mac, iOS and Android Outlook) inserts the right signature at compose time, managed centrally.
   - Downside, stated honestly in the product: replies from some third-party mobile mail apps may not get the signature.
2. **Phase B, server-side imprinting** for Microsoft 365 and Google Workspace, switched on per customer only once Tshaeno runs on high-availability infrastructure, with a fail-open design: if Tshaeno cannot process a message within a set time, the email is delivered without a signature rather than delayed.

## Milestones

### S1: Brand and foundations
1. Brand pack: logo (wordmark and mark), colours, type, icons, light and dark, as SVG, in `brand/`.
2. Repository, CI, tests, deploy pipeline, environments, backups.
3. Multi-tenant core: organisations, users, roles (Owner, Admin, Template manager, Analyst, Read-only), audit log, platform admin for our staff.
4. Sign-in with Microsoft, Google, email and passkeys; two-step login.

### S2: Signature studio
1. Visual drag-and-drop editor plus full HTML mode.
2. Brand kits: logos, colours, fonts, disclaimers, social icons.
3. Dynamic fields from the directory (name, title, department, phones, photo, custom attributes).
4. Templates that render correctly in Outlook, Gmail and Apple Mail, light and dark, desktop and mobile; automated rendering tests.
5. A starter library of at least 30 professional templates by industry.
6. Multiple signatures per user; new versus reply signatures.

### S3: Connect and apply (phase A)
1. Guided connection to Google Workspace (domain-wide delegation) and Microsoft 365 (Entra app consent), with a health check that shows exactly what is working.
2. Directory sync from Google Directory and Microsoft Entra ID, scheduled and on demand.
3. Gmail API signature push, with retries and per-user status.
4. Outlook add-in (Office.js), published for central deployment by the customer's admin.
5. Rules engine v1: by group, department, location, internal or external recipient, new or reply.
6. Coverage dashboard: who has the signature, who does not, and why.

### S4: Onboarding, plans and billing
1. The 2 to 15 user journey: sign up, connect, pick a template, apply, live in under 20 minutes. Measure time to first signature.
2. Plans: Starter (2 to 15), Growth (16 to 100), Business (101 to 999), Enterprise (1,000+, quote). Per user per month, annual discount, BWP, ZAR and USD, prices managed in the admin area.
3. Free trial; Starter has a free option with a small "Signature by Tshaeno" link as a growth loop, removable on paid plans.
4. Direct checkout (DPO Pay when live, bank transfer meanwhile), branded invoices, self-service upgrades.
5. Self-service portal for staff to update their own photo and social links within the rules.

### S5: Partner API and the Fourth Generation marketplace
1. Provisioning API (create organisation with first Admin, change plan and seats, suspend, resume, cancel, usage), signed requests, idempotency, audit. Same design as Thebe's, so the console uses one partner adapter for both.
2. "Billed by partner" organisations, and single sign-on from the Fourth Generation console.
3. `docs/partner-api.md`.

### S6: Campaigns and analytics
1. Campaign banners with scheduling, targeting and click tracking.
2. Analytics: application success, coverage, banner clicks; a simple health score for small teams, detailed reports for larger ones.
3. AI-assisted template creation and brand consistency checks (uses the Anthropic API key).

### S7: Website
Tshaeno website: product, templates gallery (top of funnel), pricing in the visitor's currency, comparison with native signatures, sign-up, and a note about buying through Fourth Generation Technologies.

### Later (not now)
Server-side imprinting (phase B) once high availability exists; SSO with SAML; SCIM; public API; data residency options; Exchange on-premises.

## Before S1 starts (business steps)
1. Confirm the spelling of the name: the blueprint uses Tshaeno; check it against "Tshiano" and settle one.
2. Check and register the domain and social handles, and run a trademark search in Botswana and South Africa.
3. Put the blueprint into the repository as `docs/blueprint.md`.

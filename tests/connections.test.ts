/**
 * Connecting directories, syncing people, pushing to Gmail and serving the
 * Outlook add-in, against stand-in Google and Microsoft servers.
 * Needs DATABASE_URL.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asTenant } from "../src/server/db";
import type { Actor } from "../src/server/org/access";
import { adminConsentUrl, newConsentFlow } from "../src/server/connections/microsoft";
import { completeMicrosoftConsent, connectGoogle, dueForSync, syncConnection, type Providers } from "../src/server/connections/service";
import { INACTIVE, NO_RULE, planGmail, pushGmail } from "../src/server/delivery/gmail";
import { addinKey, signatureForOutlook } from "../src/server/outlook/addin";
import { addCustomField, savePerson } from "../src/server/signatures/people";
import { addAssignment, createTemplate, publishTemplate, removeAssignment } from "../src/server/signatures/templates";
import { FakeGoogle, FakeMicrosoft } from "./fakes";
import { db, dbUrl, newOwner, testDeps } from "./helpers";

const ORIGIN = "https://app.tshaeno.test";
const ADMIN = "admin@kalahari.example";

describe.skipIf(!dbUrl)("connections and delivery", () => {
  const deps = testDeps();
  let owner: Awaited<ReturnType<typeof newOwner>>;
  let other: Awaited<ReturnType<typeof newOwner>>;
  let actor: Actor;
  const google = new FakeGoogle();
  const microsoft = new FakeMicrosoft();
  const providers: Providers = { google: () => google.client(), microsoft: (t) => microsoft.client(t), redeemConsent: microsoft.redeemConsent };
  const ctx = () => ({ db, organisationId: owner.organisationId, actor });
  const orgId = () => owner.organisationId;
  let googleConnection = "";

  beforeAll(async () => {
    owner = await newOwner(deps);
    other = await newOwner(deps, "Other");
    const m = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { userId: owner.userId } }));
    actor = { membershipId: m.id, userId: owner.userId, name: "Neo Dube", role: "OWNER" };
    google.pageSize = 2;
    google.users = [
      {
        id: "g1",
        primaryEmail: "lesedi@kalahari.example",
        name: { givenName: "Lesedi", familyName: "Molefe" },
        organizations: [{ title: "Head of Operations", department: "Operations", location: "Gaborone", primary: true }],
        customSchemas: { Employee: { Pronouns: "she/her" } },
      },
      { id: "g2", primaryEmail: "kabo@kalahari.example", name: { givenName: "Kabo", familyName: "Moremi" }, organizations: [{ title: "Driver", department: "Fleet" }] },
      { id: "g3", primaryEmail: "mpho@kalahari.example", name: { givenName: "Mpho" }, suspended: true },
    ];
    google.groups = [{ email: "sales@kalahari.example", name: "Sales Team", members: ["kabo@kalahari.example"] }];
  });
  afterAll(() => db.$disconnect());

  it("connects Google and shows exactly what works", async () => {
    google.allowed.delete("https://www.googleapis.com/auth/gmail.settings.basic");
    const partial = await connectGoogle(ctx(), "Admin@Kalahari.example", providers);
    expect(partial.status).toBe("PENDING");
    expect(partial.adminEmail).toBe(ADMIN);
    expect((partial.health as { key: string; ok: boolean }[]).map((h) => [h.key, h.ok])).toEqual([
      ["users", true],
      ["groups", true],
      ["gmail", false],
    ]);
    google.allowed.add("https://www.googleapis.com/auth/gmail.settings.basic");
    const full = await connectGoogle(ctx(), ADMIN, providers);
    expect(full.status).toBe("CONNECTED");
    googleConnection = full.id;
    expect(await dueForSync(new Date(), db)).toContain(full.id);
    await expect(connectGoogle({ ...ctx(), actor: { ...actor, role: "TEMPLATE_MANAGER" } }, ADMIN, providers)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("syncs people, claiming those added by hand, and filling mapped custom fields", async () => {
    await addCustomField(ctx(), "Pronouns", "Employee.Pronouns");
    const manual = await savePerson(ctx(), null, { email: "lesedi@kalahari.example", firstName: "Lesedi", title: "Old title" });
    const outcome = await syncConnection(googleConnection, providers, db);
    expect(outcome).toMatchObject({ ok: true, result: { total: 3, added: 2, updated: 1, deactivated: 0 } });
    const people = await asTenant(orgId(), (tx) => tx.person.findMany({ orderBy: { email: "asc" } }));
    expect(people.map((p) => [p.email, p.source, p.active, p.title, p.location, p.groups])).toEqual([
      ["kabo@kalahari.example", "GOOGLE", true, "Driver", "", ["Sales Team"]],
      ["lesedi@kalahari.example", "GOOGLE", true, "Head of Operations", "Gaborone", []],
      ["mpho@kalahari.example", "GOOGLE", false, "", "", []],
    ]);
    const lesedi = people.find((p) => p.email === "lesedi@kalahari.example")!;
    expect(lesedi.id).toBe(manual.id);
    expect(lesedi.custom).toEqual({ pronouns: "she/her" });
  });

  it("switches off people who leave, and refuses a sync that suddenly sees nobody", async () => {
    const kabo = google.users.splice(1, 1)[0];
    expect(await syncConnection(googleConnection, providers, db)).toMatchObject({ ok: true, result: { deactivated: 1, updated: 0 } });
    google.users.splice(1, 0, kabo);
    expect(await syncConnection(googleConnection, providers, db)).toMatchObject({ ok: true, result: { updated: 1 } });

    const saved = google.users;
    google.users = [];
    const refused = await syncConnection(googleConnection, providers, db);
    expect(refused).toMatchObject({ ok: false, retryable: false });
    google.users = saved;
    const c = await asTenant(orgId(), (tx) => tx.directoryConnection.findFirstOrThrow({ where: { id: googleConnection } }));
    expect(c.lastSyncError).toMatch(/returned nobody/);
    expect(await asTenant(orgId(), (tx) => tx.person.count({ where: { active: true } }))).toBe(2);
  });

  let template = "";
  let everyoneRule = "";

  it("pushes each person's signature to Gmail once, and again only when it changes", async () => {
    // No rule yet: nothing to push, and the reason is recorded.
    expect(await planGmail(orgId(), { providers, db, origin: ORIGIN })).toEqual([]);
    const reasons = await asTenant(orgId(), (tx) => tx.signatureDelivery.findMany({ where: { target: "GMAIL" }, include: { person: true } }));
    expect(Object.fromEntries(reasons.map((d) => [d.person.email, d.lastError]))).toEqual({
      "kabo@kalahari.example": NO_RULE,
      "lesedi@kalahari.example": NO_RULE,
      "mpho@kalahari.example": INACTIVE,
    });

    template = (await createTemplate(ctx(), { name: "Everyday", kind: "VISUAL", starterKey: "general-everyday" })).id;
    await publishTemplate(ctx(), template);
    everyoneRule = (await addAssignment(ctx(), { templateId: template, scope: "EVERYONE", forNew: true, forReply: true })).id;

    const due = await planGmail(orgId(), { providers, db, origin: ORIGIN });
    expect(due).toHaveLength(2);
    for (const id of due) expect(await pushGmail(orgId(), id, { providers, db, origin: ORIGIN })).toBe("applied");
    expect(google.signatures.get("lesedi@kalahari.example")).toContain("Lesedi Molefe");
    expect(google.signatures.get("kabo@kalahari.example")).toContain("Driver");
    expect(google.signatures.has("mpho@kalahari.example")).toBe(false);

    expect(await planGmail(orgId(), { providers, db, origin: ORIGIN })).toEqual([]);
    expect(await planGmail(orgId(), { providers, db, origin: ORIGIN, force: true })).toHaveLength(2);
  });

  it("retries when Google is busy and gives up with a reason", async () => {
    const lesedi = await asTenant(orgId(), (tx) => tx.person.findFirstOrThrow({ where: { email: "lesedi@kalahari.example" } }));
    google.failNext = { count: 2, status: 503, message: "Backend Error" };
    expect(await pushGmail(orgId(), lesedi.id, { providers, db, origin: ORIGIN })).toBe("retry");
    let d = await asTenant(orgId(), (tx) => tx.signatureDelivery.findFirstOrThrow({ where: { personId: lesedi.id, target: "GMAIL" } }));
    expect(d).toMatchObject({ state: "PENDING", lastError: expect.stringMatching(/tried again/) });
    expect(await pushGmail(orgId(), lesedi.id, { providers, db, origin: ORIGIN, final: true })).toBe("failed");
    d = await asTenant(orgId(), (tx) => tx.signatureDelivery.findFirstOrThrow({ where: { personId: lesedi.id, target: "GMAIL" } }));
    expect(d.state).toBe("FAILED");
    expect(await pushGmail(orgId(), lesedi.id, { providers, db, origin: ORIGIN })).toBe("applied");
    d = await asTenant(orgId(), (tx) => tx.signatureDelivery.findFirstOrThrow({ where: { personId: lesedi.id, target: "GMAIL" } }));
    expect(d).toMatchObject({ state: "APPLIED", lastError: null });
  });

  it("serves Outlook the internal or external signature by recipient", async () => {
    const internal = await createTemplate(ctx(), { name: "Internal", kind: "HTML" });
    await publishTemplate(ctx(), internal.id);
    await addAssignment(ctx(), { templateId: internal.id, scope: "EVERYONE", forNew: true, forReply: true, audience: "INTERNAL" });
    const key = await addinKey(ctx());
    expect(await addinKey(ctx())).toBe(key);

    const ask = (domains: string[], email = "lesedi@kalahari.example") => signatureForOutlook({ key, email, compose: "new", domains }, ORIGIN, db);
    const external = await ask(["client.example", "kalahari.example"]);
    const inside = await ask(["kalahari.example"]);
    const none = await ask([]);
    expect(external?.html).toContain("Lesedi Molefe");
    expect(inside?.html).not.toEqual(external?.html);
    expect(none?.html).toEqual(external?.html);
    expect(await ask(["client.example"], "stranger@kalahari.example")).toEqual({ html: null, reason: "not-in-directory" });
    expect(await ask(["client.example"], "mpho@kalahari.example")).toEqual({ html: null, reason: "not-in-directory" });
    expect(await signatureForOutlook({ key: "x".repeat(32), email: "lesedi@kalahari.example", compose: "new", domains: [] }, ORIGIN, db)).toBeNull();

    const seen = await asTenant(orgId(), (tx) => tx.signatureDelivery.findFirstOrThrow({ where: { target: "OUTLOOK", person: { email: "lesedi@kalahari.example" } } }));
    expect(seen.state).toBe("APPLIED");
    expect(seen.appliedAt).not.toBeNull();

    // Another organisation can't see any of it.
    await asTenant(other.organisationId, async (tx) => {
      expect(await tx.directoryConnection.count()).toBe(0);
      expect(await tx.signatureDelivery.count()).toBe(0);
      expect(await tx.outlookAddin.count()).toBe(0);
    });
  });

  it("records who no rule covers once a rule goes", async () => {
    await removeAssignment(ctx(), everyoneRule);
    expect(await planGmail(orgId(), { providers, db, origin: ORIGIN })).toEqual([]);
    const states = await asTenant(orgId(), (tx) => tx.signatureDelivery.findMany({ where: { target: "GMAIL", person: { active: true } } }));
    expect(states.every((d) => d.state === "SKIPPED" && d.lastError === NO_RULE)).toBe(true);
  });

  // Fresh per run, since the database keeps tenants other runs connected.
  const tenant = randomUUID();

  it("completes Microsoft consent once, with the tenant Microsoft vouches for", async () => {
    microsoft.signInTenant = tenant;
    const redirect = `${ORIGIN}/connect/microsoft/callback`;
    const consentLink = async () => {
      // Builds the link as the app does, with this test's endpoints.
      const flow = newConsentFlow();
      await asTenant(orgId(), (tx) =>
        tx.directoryConnection.upsert({
          where: { organisationId_provider: { organisationId: orgId(), provider: "MICROSOFT" } },
          create: { organisationId: orgId(), provider: "MICROSOFT", consentState: flow.state, consentFlow: { nonce: flow.nonce, verifier: flow.verifier, redirectUri: redirect, createdAt: new Date().toISOString() } },
          update: { consentState: flow.state, consentFlow: { nonce: flow.nonce, verifier: flow.verifier, redirectUri: redirect, createdAt: new Date().toISOString() } },
        }),
      );
      return adminConsentUrl({ clientId: "ms-client" }, redirect, flow, { login: "https://login.test", graph: "https://graph.test" });
    };
    const back = async (link: string) => Object.fromEntries(new URL((await microsoft.fetch(link)).headers.get("location")!).searchParams);

    // Declined: the state is spent.
    const declined = new URL(await consentLink()).searchParams.get("state")!;
    expect(await completeMicrosoftConsent({ state: declined, error: "access_denied" }, providers, db)).toMatchObject({ ok: false, message: expect.stringMatching(/global admin/) });
    expect(await completeMicrosoftConsent({ state: declined, code: "x" }, providers, db)).toMatchObject({ ok: false, organisationId: null });

    // A code that doesn't redeem fails.
    const bad = new URL(await consentLink()).searchParams.get("state")!;
    expect(await completeMicrosoftConsent({ state: bad, code: "made-up" }, providers, db)).toMatchObject({ ok: false, message: expect.stringMatching(/new link/) });

    // Expired links don't work.
    const late = await back(await consentLink());
    expect(await completeMicrosoftConsent(late, providers, db, new Date(Date.now() + 8 * 86_400_000))).toMatchObject({ ok: false, message: expect.stringMatching(/expired/) });

    const q = await back(await consentLink());
    const done = await completeMicrosoftConsent(q, providers, db);
    expect(done).toMatchObject({ ok: true, organisationId: orgId(), connection: { status: "CONNECTED", tenantId: tenant, consentState: null, consentFlow: null } });
    expect(await completeMicrosoftConsent(q, providers, db)).toMatchObject({ ok: false, organisationId: null });
  });

  it("won't connect one Microsoft 365 tenant to two organisations", async () => {
    const redirect = `${ORIGIN}/connect/microsoft/callback`;
    const flow = newConsentFlow();
    const data = { consentState: flow.state, consentFlow: { nonce: flow.nonce, verifier: flow.verifier, redirectUri: redirect, createdAt: new Date().toISOString() } };
    await asTenant(other.organisationId, (tx) => tx.directoryConnection.create({ data: { organisationId: other.organisationId, provider: "MICROSOFT", ...data } }));
    const res = await microsoft.fetch(adminConsentUrl({ clientId: "ms-client" }, redirect, flow, { login: "https://login.test", graph: "https://graph.test" }));
    const q = Object.fromEntries(new URL(res.headers.get("location")!).searchParams);
    expect(await completeMicrosoftConsent(q, providers, db)).toMatchObject({ ok: false, message: expect.stringMatching(/already connected/) });
    const c = await asTenant(other.organisationId, (tx) => tx.directoryConnection.findFirstOrThrow({ where: { provider: "MICROSOFT" } }));
    expect(c.tenantId).toBeNull();
  });
});

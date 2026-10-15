/**
 * The partner API: signed requests, idempotent changes, the request log,
 * and what a partner can do to the organisations it set up.
 */
import { randomBytes } from "node:crypto";
import type { Partner } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, dbUrl, tag, testDeps } from "./helpers";

process.env.TOTP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");

describe.skipIf(!dbUrl)("partner API", async () => {
  const { sign } = await import("../src/server/partner/signing");
  const { createPartner, updatePartner } = await import("../src/server/partner/service");
  const { asSystem, asTenant } = await import("../src/server/db");
  const { savePerson } = await import("../src/server/signatures/people");
  const { gmailOrganisations } = await import("../src/server/delivery/gmail");
  const { setOrganisationStatus } = await import("../src/server/platform/service");
  const orgs = await import("../src/app/api/partner/v1/organisations/route");
  const one = await import("../src/app/api/partner/v1/organisations/[reference]/route");
  const suspendRoute = await import("../src/app/api/partner/v1/organisations/[reference]/suspend/route");
  const resumeRoute = await import("../src/app/api/partner/v1/organisations/[reference]/resume/route");
  const cancelRoute = await import("../src/app/api/partner/v1/organisations/[reference]/cancel/route");
  const usageRoute = await import("../src/app/api/partner/v1/organisations/[reference]/usage/route");
  const pricesRoute = await import("../src/app/api/partner/v1/prices/route");

  const t = tag();
  const ref = `cust-${t}`;
  const key = process.env.TOTP_ENCRYPTION_KEY!;
  const staff = { userId: `staff-${t}`, name: "Neo Staff", isPlatformAdmin: true };
  let partner: Partner;
  let secret: string;
  let other: { partner: Partner; secret: string };

  function request(
    method: string,
    path: string,
    body?: unknown,
    o: { key?: string; secret?: string; idem?: string | null; ts?: number; ip?: string; signature?: string } = {},
  ) {
    const text = body === undefined ? "" : JSON.stringify(body);
    const ts = String(o.ts ?? Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = {
      "x-tshaeno-key": o.key ?? partner.keyId,
      "x-tshaeno-timestamp": ts,
      "x-tshaeno-signature": o.signature ?? sign(o.secret ?? secret, ts, method, path, text),
      "x-forwarded-for": o.ip ?? "196.45.10.1",
    };
    if (o.idem !== null) headers["idempotency-key"] = o.idem ?? `idem-${randomBytes(6).toString("hex")}`;
    return new Request(`http://localhost:3000${path}`, { method, headers, body: text || undefined });
  }
  const params = (reference = ref) => ({ params: Promise.resolve({ reference }) });
  const owner = `tumelo-${t}@kgale.example`;
  const provisionBody = { reference: ref, name: `Kgale Hill Traders ${t}`, seats: 20, currency: "BWP", owner: { name: "Tumelo Sello", email: owner } };
  const orgRow = () => asSystem((tx) => tx.organisation.findFirstOrThrow({ where: { partnerId: partner.id, partnerReference: ref }, include: { subscription: true } }), db);

  beforeAll(async () => {
    ({ partner, secret } = await createPartner(staff, `Fourth Generation ${t}`, key, null, db));
    other = await createPartner(staff, `Other partner ${t}`, key, null, db);
  });
  afterAll(() => db.$disconnect());

  it("refuses unknown keys, wrong signatures, stale times and changed bodies", async () => {
    expect((await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody, { key: "pk_nobody" }))).status).toBe(401);
    const bad = await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody, { secret: "ps_wrong" }));
    expect(bad.status).toBe(401);
    expect((await bad.json()).error.code).toBe("bad_signature");
    const stale = await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody, { ts: Math.floor(Date.now() / 1000) - 900 }));
    expect((await stale.json()).error.code).toBe("stale");
    const ts = String(Math.floor(Date.now() / 1000));
    const tampered = new Request("http://localhost:3000/api/partner/v1/organisations", {
      method: "POST",
      headers: {
        "x-tshaeno-key": partner.keyId,
        "x-tshaeno-timestamp": ts,
        "x-tshaeno-signature": sign(secret, ts, "POST", "/api/partner/v1/organisations", JSON.stringify(provisionBody)),
        "idempotency-key": "tampered",
      },
      body: JSON.stringify({ ...provisionBody, seats: 1 }),
    });
    expect((await (await orgs.POST(tampered)).json()).error.code).toBe("bad_signature");
    // Another partner's secret doesn't work with this key.
    expect((await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody, { secret: other.secret }))).status).toBe(401);
    const logged = await asSystem((tx) => tx.partnerRequest.count({ where: { partnerId: partner.id, status: 401 } }), db);
    expect(logged).toBeGreaterThanOrEqual(3);
  });

  it("needs an Idempotency-Key on changes and lists every wrong field", async () => {
    const none = await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody, { idem: null }));
    expect(none.status).toBe(400);
    expect((await none.json()).error.code).toBe("idempotency_key_required");
    const invalid = await orgs.POST(request("POST", "/api/partner/v1/organisations", { reference: "", name: "K", seats: 0, currency: "EUR", owner: { name: "", email: "no" } }));
    expect(invalid.status).toBe(422);
    const fields = (await invalid.json()).error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["reference", "name", "seats", "currency", "owner.name", "owner.email"]));
  });

  it("sets up an organisation billed by the partner, and invites its owner", async () => {
    const idem = `order-${t}`;
    const res = await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody, { idem }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ reference: ref, plan: "GROWTH", seats: 20, currency: "BWP", status: "active", suspendedBy: null });

    const org = await orgRow();
    expect(org.subscription).toMatchObject({ status: "ACTIVE", billedBy: "PARTNER", tier: "GROWTH", seats: 20, trialEndsAt: null });
    const invitation = await asTenant(org.id, (tx) => tx.invitation.findFirstOrThrow({ where: { email: owner } }), db);
    expect(invitation).toMatchObject({ role: "OWNER", invitedById: null, invitedByLabel: partner.name });
    expect(await asSystem((tx) => tx.outboundEmail.count({ where: { kind: "invitation", toAddress: owner } }), db)).toBe(1);
    const trail = await asTenant(org.id, (tx) => tx.auditLog.findFirstOrThrow({ where: { action: "organisation.provisioned" } }), db);
    expect(trail.actorLabel).toBe(`${partner.name} (partner)`);

    // The same change again returns the first answer and does nothing new.
    const again = await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody, { idem }));
    expect(again.status).toBe(201);
    expect(again.headers.get("idempotent-replayed")).toBe("true");
    expect((await again.json()).id).toBe(body.id);
    expect(await asSystem((tx) => tx.outboundEmail.count({ where: { kind: "invitation", toAddress: owner } }), db)).toBe(1);

    // The same key for another change is refused; a new key for the same customer is a conflict.
    const reused = await orgs.POST(request("POST", "/api/partner/v1/organisations", { ...provisionBody, seats: 30 }, { idem }));
    expect(reused.status).toBe(422);
    expect((await reused.json()).error.code).toBe("idempotency_key_reused");
    const dup = await orgs.POST(request("POST", "/api/partner/v1/organisations", provisionBody));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("exists");
  });

  it("keeps partners to their own organisations", async () => {
    const res = await one.GET(request("GET", `/api/partner/v1/organisations/${ref}`, undefined, { key: other.partner.keyId, secret: other.secret, idem: null }), params());
    expect(res.status).toBe(404);
    const mine = await one.GET(request("GET", `/api/partner/v1/organisations/${ref}`, undefined, { idem: null }), params());
    expect((await mine.json()).reference).toBe(ref);
  });

  it("changes the plan and seats, but never below the people in the directory", async () => {
    const org = await orgRow();
    const ctx = { db, organisationId: org.id, actor: { membershipId: "", userId: null as unknown as string, name: "Test", role: "OWNER" as const } };
    for (const [i, name] of ["Lesedi", "Kabo", "Thato"].entries()) await savePerson(ctx, null, { email: `p${i}-${t}@kgale.example`, firstName: name });
    const tooFew = await one.PATCH(request("PATCH", `/api/partner/v1/organisations/${ref}`, { seats: 2 }), params());
    expect(tooFew.status).toBe(409);
    expect(await tooFew.json()).toMatchObject({ error: { code: "too_few_seats", details: { people: 3 } } });
    const ok = await one.PATCH(request("PATCH", `/api/partner/v1/organisations/${ref}`, { plan: "STARTER", seats: 5, name: `Kgale Hill ${t}` }), params());
    expect(await ok.json()).toMatchObject({ plan: "STARTER", seats: 5, name: `Kgale Hill ${t}` });
    const unknown = await one.PATCH(request("PATCH", `/api/partner/v1/organisations/${ref}`, { owner: "x" }), params());
    expect(unknown.status).toBe(422);
  });

  it("reports usage without names or addresses", async () => {
    const res = await usageRoute.GET(request("GET", `/api/partner/v1/organisations/${ref}/usage`, undefined, { idem: null }), params());
    const usage = await res.json();
    expect(usage).toMatchObject({ reference: ref, plan: "STARTER", seats: 5, people: 3, admins: 0, connected: [], outlookAddIn: false, peopleWithSignature: 0 });
    expect(JSON.stringify(usage)).not.toContain("@");
  });

  it("pauses and resumes, but can't lift a pause by Tshaeno", async () => {
    const paused = await suspendRoute.POST(request("POST", `/api/partner/v1/organisations/${ref}/suspend`, { reason: "Unpaid bill" }), params());
    expect(await paused.json()).toMatchObject({ status: "suspended", suspendedBy: "partner" });
    expect((await orgRow()).suspendedReason).toBe(`${partner.name}: Unpaid bill`);
    const back = await resumeRoute.POST(request("POST", `/api/partner/v1/organisations/${ref}/resume`), params());
    expect(await back.json()).toMatchObject({ status: "active", suspendedBy: null });

    const org = await orgRow();
    await setOrganisationStatus(staff, org.id, "SUSPENDED", "Abuse report", null, db);
    const blocked = await resumeRoute.POST(request("POST", `/api/partner/v1/organisations/${ref}/resume`), params());
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.code).toBe("suspended_by_tshaeno");
    const alsoBlocked = await suspendRoute.POST(request("POST", `/api/partner/v1/organisations/${ref}/suspend`), params());
    expect(alsoBlocked.status).toBe(409);
    await setOrganisationStatus(staff, org.id, "ACTIVE", "Resolved", null, db);
  });

  it("cancels, which stops syncing and applying, and resume brings it back", async () => {
    const org = await orgRow();
    await asSystem(
      (tx) => tx.directoryConnection.create({ data: { organisationId: org.id, provider: "GOOGLE", status: "CONNECTED", pushEnabled: true, adminEmail: `admin@${t}.example` } }),
      db,
    );
    expect(await gmailOrganisations(db)).toContain(org.id);
    const res = await cancelRoute.POST(request("POST", `/api/partner/v1/organisations/${ref}/cancel`, { reason: "Moved away" }), params());
    expect(await res.json()).toMatchObject({ status: "cancelled" });
    expect(await gmailOrganisations(db)).not.toContain(org.id);
    await resumeRoute.POST(request("POST", `/api/partner/v1/organisations/${ref}/resume`), params());
    expect((await orgRow()).subscription?.status).toBe("ACTIVE");
    expect(await gmailOrganisations(db)).toContain(org.id);
  });

  it("gives retail and wholesale prices", async () => {
    await updatePartner(staff, partner.id, { name: partner.name, allowedIps: "", wholesaleDiscountPercent: "20", active: true }, null, db);
    const res = await pricesRoute.GET(request("GET", "/api/partner/v1/prices", undefined, { idem: null }));
    const body = await res.json();
    expect(body.wholesaleDiscountPercent).toBe(20);
    const starter = body.prices.find((p: { plan: string; currency: string }) => p.plan === "STARTER" && p.currency === "USD");
    expect(Number(starter.wholesale.monthly)).toBe(Math.round(Number(starter.retail.monthly) * 0.8));
  });

  it("limits calls to the partner's addresses and refuses a turned-off key", async () => {
    await updatePartner(staff, partner.id, { name: partner.name, allowedIps: "196.45.10.9", wholesaleDiscountPercent: "0", active: true }, null, db);
    const blocked = await one.GET(request("GET", `/api/partner/v1/organisations/${ref}`, undefined, { idem: null }), params());
    expect(blocked.status).toBe(403);
    expect((await one.GET(request("GET", `/api/partner/v1/organisations/${ref}`, undefined, { idem: null, ip: "196.45.10.9" }), params())).status).toBe(200);
    await expect(updatePartner(staff, partner.id, { name: partner.name, allowedIps: "not-an-ip", wholesaleDiscountPercent: "0", active: true }, null, db)).rejects.toMatchObject({
      field: "allowedIps",
    });
    await updatePartner(staff, partner.id, { name: partner.name, allowedIps: "", wholesaleDiscountPercent: "0", active: false }, null, db);
    expect((await one.GET(request("GET", `/api/partner/v1/organisations/${ref}`, undefined, { idem: null }), params())).status).toBe(401);
  });

  it("lets the invited owner straight in when they arrive from the Fourth Generation console", async () => {
    const { signInWithIdentity } = await import("../src/server/auth/service");
    const org = await orgRow();
    const r = await signInWithIdentity(testDeps(), { provider: "FOURTHGEN", subject: `fg-${t}`, email: owner, emailVerified: true, name: "Tumelo Sello" });
    expect(r.isNew).toBe(true);
    const m = await asTenant(org.id, (tx) => tx.membership.findFirstOrThrow({ where: { user: { email: owner } } }), db);
    expect(m.role).toBe("OWNER");
    const inv = await asTenant(org.id, (tx) => tx.invitation.findFirstOrThrow({ where: { email: owner } }), db);
    expect(inv.acceptedAt).not.toBeNull();
  });

  it("never changes the request log", async () => {
    await expect(asSystem((tx) => tx.partnerRequest.deleteMany({ where: { partnerId: partner.id } }), db)).rejects.toThrow(/append-only/);
  });
});

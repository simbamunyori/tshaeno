/**
 * Free signatures and the full plan: premium features are refused on free
 * signatures, campaigns drop out of signatures, and the full plan adds
 * meeting backgrounds and out-of-office replies in Gmail and Outlook.
 */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasPremium } from "../src/lib/billing/features";
import { awayHtml, awayState, cancelAway, setAway, type AwayInput } from "../src/server/away/service";
import { backgrounds, saveBackground } from "../src/server/backgrounds/service";
import { requestUpgrade } from "../src/server/billing/service";
import { saveCampaign } from "../src/server/campaigns/service";
import type { Providers } from "../src/server/connections/service";
import { asSystem, asTenant } from "../src/server/db";
import { GMAIL_CONTEXT } from "../src/server/delivery/gmail";
import { OrgRenderer } from "../src/server/delivery/renderer";
import { quickStart } from "../src/server/onboarding/service";
import type { Actor } from "../src/server/org/access";
import { db, dbUrl, newOwner, testDeps } from "./helpers";
import { FakeGoogle, FakeMicrosoft, TENANT } from "./fakes";

process.env.TOTP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");

const ORIGIN = "https://app.tshaeno.test";
const DAY = 86_400_000;

describe("who gets premium features", () => {
  it("gives them to trials and paid plans, and to partner customers only on the full package", () => {
    expect(hasPremium(null)).toBe(true);
    expect(hasPremium({ status: "TRIALING", billedBy: "DIRECT", package: "FULL" })).toBe(true);
    expect(hasPremium({ status: "ACTIVE", billedBy: "DIRECT", package: "FULL" })).toBe(true);
    expect(hasPremium({ status: "PAST_DUE", billedBy: "DIRECT", package: "FULL" })).toBe(true);
    expect(hasPremium({ status: "FREE", billedBy: "DIRECT", package: "FULL" })).toBe(false);
    expect(hasPremium({ status: "ACTIVE", billedBy: "PARTNER", package: "SIGNATURES" })).toBe(false);
    expect(hasPremium({ status: "ACTIVE", billedBy: "PARTNER", package: "FULL" })).toBe(true);
    expect(hasPremium({ status: "CANCELLED", billedBy: "PARTNER", package: "FULL" })).toBe(false);
  });

  it("writes the reply as safe HTML with the signature under it", () => {
    const html = awayHtml("Hello,\n\nI'm away <until> Monday.\nThanks", "<table>sig</table>");
    expect(html).toContain("&lt;until&gt;");
    expect(html).toContain("<br>Thanks");
    expect(html.endsWith("<br><table>sig</table>")).toBe(true);
    const now = new Date("2026-11-01T10:00:00Z");
    expect(awayState({ status: "SET", startsAt: new Date("2026-11-02T00:00:00Z"), endsAt: new Date("2026-11-09T00:00:00Z") }, now)).toBe("scheduled");
    expect(awayState({ status: "SET", startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-11-09T00:00:00Z") }, now)).toBe("on");
    expect(awayState({ status: "CANCELLED", startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-11-09T00:00:00Z") }, now)).toBe("cancelled");
  });
});

describe.skipIf(!dbUrl)("free signatures and the full plan", () => {
  const deps = testDeps();
  const google = new FakeGoogle();
  const microsoft = new FakeMicrosoft();
  const providers: Providers = { google: () => google.client(), microsoft: (t) => microsoft.client(t), redeemConsent: microsoft.redeemConsent };
  let owner: Awaited<ReturnType<typeof newOwner>>;
  let actor: Actor;
  const ctx = () => ({ db, organisationId: owner.organisationId, actor });
  const orgId = () => owner.organisationId;
  let gmailPerson: string;
  let outlookPerson: string;
  let manualPerson: string;
  const setPlan = (data: { status?: "FREE" | "ACTIVE" | "TRIALING"; billedBy?: "DIRECT" | "PARTNER"; package?: "SIGNATURES" | "FULL" }) =>
    asSystem((tx) => tx.subscription.update({ where: { organisationId: orgId() }, data }), db);
  const banner = () => sharp({ create: { width: 1200, height: 300, channels: 4, background: { r: 20, g: 33, b: 61, alpha: 1 } } }).png().toBuffer();
  const away = (personId: string, over: Partial<AwayInput> = {}): AwayInput => ({
    personId,
    reason: "leave",
    startsAt: new Date(Date.now() + DAY),
    endsAt: new Date(Date.now() + 8 * DAY),
    subject: "Out of office until Monday",
    message: "Hello,\n\nI'm on leave and back on Monday.",
    withSignature: true,
    ...over,
  });

  beforeAll(async () => {
    owner = await newOwner(deps);
    const m = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { userId: owner.userId } }));
    actor = { membershipId: m.id, userId: owner.userId, name: "Neo Dube", role: "OWNER" };
    await asTenant(orgId(), async (tx) => {
      await tx.directoryConnection.create({ data: { organisationId: orgId(), provider: "GOOGLE", status: "CONNECTED", adminEmail: "admin@kalahari.example" } });
      await tx.directoryConnection.create({ data: { organisationId: orgId(), provider: "MICROSOFT", status: "CONNECTED", tenantId: TENANT } });
      gmailPerson = (await tx.person.create({ data: { organisationId: orgId(), email: "lesedi@kalahari.example", firstName: "Lesedi", lastName: "Molefe", title: "Sales lead", source: "GOOGLE" } })).id;
      outlookPerson = (await tx.person.create({ data: { organisationId: orgId(), email: "kabo@kalahari.example", firstName: "Kabo", lastName: "Sebina", source: "MICROSOFT" } })).id;
      manualPerson = (await tx.person.create({ data: { organisationId: orgId(), email: "naledi@kalahari.example", firstName: "Naledi", source: "MANUAL" } })).id;
    }, db);
    google.users.push({ id: "g1", primaryEmail: "lesedi@kalahari.example" });
    await quickStart(ctx(), "general-everyday");
  });
  afterAll(() => db.$disconnect());

  it("keeps campaigns, backgrounds and out-of-office off free signatures, and drops running campaigns", async () => {
    const c = await saveCampaign(ctx(), null, { name: "Winter sale", linkUrl: "https://kalahari.example/winter", alt: "Winter sale", width: 480, startsAt: null, endsAt: null, scope: "EVERYONE", target: "", audience: "ANY", forNew: true, forReply: true }, await banner());
    const render = () =>
      asTenant(orgId(), async (tx) => {
        const p = await tx.person.findFirstOrThrow({ where: { id: gmailPerson }, include: { photo: { select: { id: true, contentType: true, width: true, height: true } } } });
        return new OrgRenderer(tx, orgId(), ORIGIN).render(p, GMAIL_CONTEXT);
      }, db);
    expect((await render())?.html).toContain(`/c/${c.key}/`);

    await setPlan({ status: "ACTIVE", billedBy: "PARTNER", package: "SIGNATURES" });
    const out = await render();
    expect(out?.html).toBeTruthy();
    expect(out?.html).not.toContain(`/c/${c.key}/`);
    await expect(saveCampaign(ctx(), c.id, { name: "Again", linkUrl: "https://kalahari.example", alt: "x", width: 480, startsAt: null, endsAt: null, scope: "EVERYONE", target: "", audience: "ANY", forNew: true, forReply: false }, null)).rejects.toMatchObject({
      code: "forbidden",
      message: expect.stringContaining("Ask Fourth Generation"),
    });
    await expect(saveBackground(ctx(), null, { name: "Main", style: "panel", colour: "#14213D", brandKitId: null, showName: true, showTitle: true, published: true }, null)).rejects.toMatchObject({ code: "forbidden" });
    await expect(setAway(ctx(), away(gmailPerson), providers, ORIGIN)).rejects.toMatchObject({ code: "forbidden" });

    await setPlan({ status: "FREE", billedBy: "DIRECT", package: "FULL" });
    await expect(saveBackground(ctx(), null, { name: "Main", style: "panel", colour: "#14213D", brandKitId: null, showName: true, showTitle: true, published: true }, null)).rejects.toMatchObject({
      message: expect.stringContaining("Plan and billing"),
    });

    await setPlan({ status: "ACTIVE", billedBy: "PARTNER", package: "FULL" });
    expect((await render())?.html).toContain(`/c/${c.key}/`);
  });

  it("asks for an upgrade once a day", async () => {
    await requestUpgrade(ctx(), "Campaigns");
    await expect(requestUpgrade(ctx(), "Campaigns")).rejects.toMatchObject({ code: "conflict" });
    const log = await asTenant(orgId(), (tx) => tx.auditLog.findFirst({ where: { action: "billing.upgrade_requested" } }), db);
    expect(log).toBeTruthy();
  });

  it("saves meeting backgrounds with a picture for the photo style", async () => {
    await expect(saveBackground(ctx(), null, { name: "Office", style: "photo", colour: "#14213D", brandKitId: null, showName: true, showTitle: true, published: true }, null)).rejects.toMatchObject({ field: "file" });
    await expect(saveBackground(ctx(), null, { name: "Bad", style: "panel", colour: "navy", brandKitId: null, showName: true, showTitle: true, published: true }, null)).rejects.toMatchObject({ field: "colour" });
    const photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 120, g: 110, b: 100 } } }).jpeg().toBuffer();
    await saveBackground(ctx(), null, { name: "Office", style: "photo", colour: "#14213D", brandKitId: null, showName: true, showTitle: false, published: true }, photo);
    await saveBackground(ctx(), null, { name: "Draft", style: "band", colour: "#6b1e2e", brandKitId: null, showName: true, showTitle: true, published: false }, null);
    const all = await asTenant(orgId(), (tx) => backgrounds(tx, orgId(), ""), db);
    const shown = await asTenant(orgId(), (tx) => backgrounds(tx, orgId(), "", true), db);
    expect(all.map((b) => b.name)).toEqual(["Office", "Draft"]);
    expect(shown.map((b) => b.name)).toEqual(["Office"]);
    expect(all[0].photoUrl).toMatch(/^\/i\/a\/.+\.jpg$/);
    expect(all[1].colour).toBe("#6B1E2E");
    const asset = await asTenant(orgId(), (tx) => tx.asset.findFirstOrThrow({ where: { kind: "BACKDROP" } }), db);
    expect([asset.width, asset.height]).toEqual([1620, 1080]);
  });

  it("sets out-of-office replies in Gmail and Outlook on their dates, and switches them off when cancelled", async () => {
    const g = await setAway(ctx(), away(gmailPerson), providers, ORIGIN);
    expect(g).toMatchObject({ status: "SET", mailbox: "Gmail", lastError: null });
    const vacation = google.vacations.get("lesedi@kalahari.example")!;
    expect(vacation).toMatchObject({ enableAutoReply: true, responseSubject: "Out of office until Monday", restrictToContacts: false });
    expect(String(vacation.responseBodyHtml)).toContain("I&#39;m on leave");
    expect(String(vacation.responseBodyHtml)).toContain("Lesedi");
    expect(vacation.startTime).toBe(String(g.startsAt.getTime()));

    const o = await setAway(ctx(), away(outlookPerson, { withSignature: false }), providers, ORIGIN);
    expect(o).toMatchObject({ status: "SET", mailbox: "Outlook" });
    const reply = microsoft.autoReplies.get("kabo@kalahari.example")!;
    expect(reply).toMatchObject({ status: "scheduled", externalAudience: "all", scheduledEndDateTime: { dateTime: o.endsAt.toISOString().replace(/Z$/, ""), timeZone: "UTC" } });

    const manual = await setAway(ctx(), away(manualPerson), providers, ORIGIN);
    expect(manual).toMatchObject({ status: "SAVED", lastError: expect.stringContaining("Copy the message") });

    // A new one for the same person replaces the old.
    const again = await setAway(ctx(), away(gmailPerson, { subject: "Away a bit longer" }), providers, ORIGIN);
    const rows = await asTenant(orgId(), (tx) => tx.awayMessage.findMany({ where: { personId: gmailPerson }, orderBy: { createdAt: "asc" } }), db);
    expect(rows.map((r) => r.status)).toEqual(["CANCELLED", "SET"]);

    await cancelAway(ctx(), again.id, providers);
    expect(google.vacations.get("lesedi@kalahari.example")).toEqual({ enableAutoReply: false });
    await cancelAway(ctx(), o.id, providers);
    expect(microsoft.autoReplies.get("kabo@kalahari.example")).toEqual({ status: "disabled" });
  });

  it("explains a missing Microsoft permission and refuses bad dates", async () => {
    microsoft.permissions.delete("MailboxSettings.ReadWrite");
    const o = await setAway(ctx(), away(outlookPerson), providers, ORIGIN);
    expect(o).toMatchObject({ status: "FAILED", lastError: expect.stringContaining("consent link") });
    microsoft.permissions.add("MailboxSettings.ReadWrite");
    await expect(setAway(ctx(), away(gmailPerson, { endsAt: new Date(Date.now() - DAY) }), providers, ORIGIN)).rejects.toMatchObject({ field: "endsAt" });
    await expect(setAway(ctx(), away(gmailPerson, { message: "Hi" }), providers, ORIGIN)).rejects.toMatchObject({ field: "message" });
    await expect(setAway({ ...ctx(), actor: { ...actor, role: "TEMPLATE_MANAGER" } }, away(gmailPerson), providers, ORIGIN)).rejects.toMatchObject({ code: "forbidden" });
  });
});

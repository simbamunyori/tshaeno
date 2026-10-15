/**
 * The self-service page: sign-in links, what people may change, and that
 * it stays inside their own organisation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystem, asTenant } from "../src/server/db";
import type { Actor } from "../src/server/org/access";
import { hashToken } from "../src/server/auth/service";
import { issueLinkToken, portalSession, redeemLink, requestLink, saveOwnSocials, setOwnPhoto, setPortal, SESSION_TTL_MS } from "../src/server/portal/service";
import { savePerson } from "../src/server/signatures/people";
import { updateKit, ensureDefaultKit, kitData } from "../src/server/signatures/brand";
import { db, dbUrl, newOwner, tag, testDeps } from "./helpers";

describe.skipIf(!dbUrl)("self-service page", () => {
  const deps = testDeps();
  let owner: Awaited<ReturnType<typeof newOwner>>;
  let actor: Actor;
  const email = `lesedi-${tag()}@kalahari.example`;
  const ctx = () => ({ db, organisationId: owner.organisationId, actor });
  const links = () => asSystem((tx) => tx.portalLink.findMany({ where: { organisationId: owner.organisationId }, orderBy: { createdAt: "asc" } }), db);

  /** Asks for a link and opens it, as the person would from their email. */
  async function signIn(now = new Date()) {
    await asSystem((tx) => tx.portalLink.deleteMany({ where: { organisationId: owner.organisationId } }), db);
    await requestLink(email, db, now);
    const [link] = await links();
    const issued = await asSystem((tx) => issueLinkToken(tx, link.id, now), db);
    return redeemLink(issued!.token, db, now);
  }

  beforeAll(async () => {
    owner = await newOwner(deps);
    const m = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { userId: owner.userId } }));
    actor = { membershipId: m.id, userId: owner.userId, name: "Neo Dube", role: "OWNER" };
    await savePerson(ctx(), null, { email, firstName: "Lesedi" });
    const kit = await asTenant(owner.organisationId, (tx) => ensureDefaultKit(tx, owner.organisationId));
    const data = kitData(kit);
    await updateKit(ctx(), kit.id, { name: kit.name, data: { ...data, socials: [{ network: "linkedin", url: "https://www.linkedin.com/company/kalahari" }] } });
  });
  afterAll(() => db.$disconnect());

  it("sends nothing while the organisation hasn't turned it on", async () => {
    await requestLink(email, db);
    expect(await links()).toEqual([]);
    await expect(setPortal({ ...ctx(), actor: { ...actor, role: "TEMPLATE_MANAGER" } }, { enabled: true, photo: true })).rejects.toMatchObject({ code: "forbidden" });
    await setPortal(ctx(), { enabled: true, photo: false });
  });

  it("emails a one-time link, at most once a minute", async () => {
    await requestLink(email.toUpperCase(), db);
    await requestLink(email, db);
    const [link, ...more] = await links();
    expect(more).toEqual([]);
    expect(await asSystem((tx) => tx.outboundEmail.count({ where: { kind: "portal_link", payload: { equals: { linkId: link.id } } } }), db)).toBe(1);
    // Only the newest email's token works.
    const a = await asSystem((tx) => issueLinkToken(tx, link.id), db);
    const b = await asSystem((tx) => issueLinkToken(tx, link.id), db);
    expect(await redeemLink(a!.token, db)).toMatchObject({ error: expect.stringMatching(/already been used/) });
    const ok = await redeemLink(b!.token, db);
    expect(ok).toHaveProperty("session");
    expect(await redeemLink(b!.token, db)).toMatchObject({ error: expect.stringMatching(/already been used/) });
    expect((await links())[0]).toMatchObject({ linkHash: null, sessionHash: hashToken((ok as { session: string }).session) });
  });

  it("expires links and sessions", async () => {
    await asSystem((tx) => tx.portalLink.deleteMany({ where: { organisationId: owner.organisationId } }), db);
    await requestLink(email, db);
    const [link] = await links();
    const issued = await asSystem((tx) => issueLinkToken(tx, link.id), db);
    expect(await redeemLink(issued!.token, db, new Date(Date.now() + 31 * 60_000))).toMatchObject({ error: expect.stringMatching(/expired/) });
    const r = (await signIn()) as { session: string };
    expect(await portalSession(r.session, db)).not.toBeNull();
    expect(await portalSession(r.session, db, new Date(Date.now() + SESSION_TTL_MS + 1000))).toBeNull();
    expect(await portalSession("made-up", db)).toBeNull();
  });

  it("lets people set links only for networks their signatures show, on that network's site", async () => {
    const r = (await signIn()) as { session: string };
    const s = (await portalSession(r.session, db))!;
    expect(s.networks).toEqual(["linkedin"]);
    await expect(saveOwnSocials(s, { linkedin: "https://evil.example/in/lesedi" }, db)).rejects.toMatchObject({ field: "social_linkedin" });
    await saveOwnSocials(s, { linkedin: "linkedin.com/in/lesedi", x: "https://x.com/ignored" }, db);
    const p = await asTenant(owner.organisationId, (tx) => tx.person.findFirstOrThrow({ where: { email } }), db);
    expect(p.socials).toEqual({ linkedin: "https://linkedin.com/in/lesedi" });
    const log = await asTenant(owner.organisationId, (tx) => tx.auditLog.findFirstOrThrow({ where: { action: "person.socials_changed" }, orderBy: { createdAt: "desc" } }), db);
    expect(log.actorLabel).toBe("Lesedi (self-service)");
  });

  it("follows the organisation's photo setting, and ends when it is turned off", async () => {
    const r = (await signIn()) as { session: string };
    const s = (await portalSession(r.session, db))!;
    await expect(setOwnPhoto(s, null, db)).rejects.toMatchObject({ code: "forbidden" });
    await setPortal(ctx(), { enabled: false, photo: true });
    expect(await portalSession(r.session, db)).toBeNull();
    expect(await links()).toEqual([]);
  });
});

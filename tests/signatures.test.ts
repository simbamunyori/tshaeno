/**
 * Brand kits, the directory, signature templates and who gets which.
 * Needs DATABASE_URL.
 */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emptyDoc, newBlock } from "../src/lib/signature/doc";
import { asTenant } from "../src/server/db";
import type { Actor } from "../src/server/org/access";
import { readPublicAsset } from "../src/server/signatures/assets";
import { ensureDefaultKit, setKitLogo, updateKit, kitData } from "../src/server/signatures/brand";
import { addCustomField, importPeople, savePerson } from "../src/server/signatures/people";
import {
  addAssignment,
  createTemplate,
  liveRules,
  publishTemplate,
  renderForPerson,
  resolveAssignments,
  saveDraft,
  setArchived,
} from "../src/server/signatures/templates";
import { db, dbUrl, newOwner, tag, testDeps } from "./helpers";

const ORIGIN = "https://app.tshaeno.test";

describe.skipIf(!dbUrl)("signatures", () => {
  const deps = testDeps();
  let a: Awaited<ReturnType<typeof newOwner>>;
  let b: Awaited<ReturnType<typeof newOwner>>;
  let actorA: Actor;
  let actorB: Actor;

  async function actorFor(o: Awaited<ReturnType<typeof newOwner>>): Promise<Actor> {
    const m = await asTenant(o.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { userId: o.userId } }));
    return { membershipId: m.id, userId: o.userId, name: "Neo Dube", role: "OWNER" };
  }

  beforeAll(async () => {
    a = await newOwner(deps, "Alpha");
    b = await newOwner(deps, "Bravo");
    actorA = await actorFor(a);
    actorB = await actorFor(b);
  });
  afterAll(() => db.$disconnect());

  const ctxA = (role: Actor["role"] = "OWNER") => ({ db, organisationId: a.organisationId, actor: { ...actorA, role } });
  const ctxB = () => ({ db, organisationId: b.organisationId, actor: actorB });

  const png = () => sharp({ create: { width: 400, height: 200, channels: 4, background: { r: 10, g: 40, b: 80, alpha: 1 } } }).png().toBuffer();

  it("adds people, imports a CSV with custom fields, and reports bad rows", async () => {
    await addCustomField(ctxA(), "Pronouns");
    const first = await savePerson(ctxA(), null, { email: "Lesedi@Example.com", firstName: "Lesedi", lastName: "Molefe", department: "Operations" });
    expect(first.email).toBe("lesedi@example.com");
    await expect(savePerson(ctxA(), null, { email: "lesedi@example.com", firstName: "Again" })).rejects.toMatchObject({ code: "conflict" });

    const csv = [
      "Email,Full name,Job title,Department,Pronouns",
      "lesedi@example.com,Lesedi Molefe,Head of Operations,Operations,she/her",
      "kabo@example.com,Kabo Moremi,Driver,Fleet,he/him",
      "not-an-email,Nobody,,,",
      "kabo@example.com,Kabo Twice,,,",
    ].join("\n");
    const r = await importPeople(ctxA(), csv);
    expect(r).toMatchObject({ added: 1, updated: 1 });
    expect(r.skipped.map((s) => s.row)).toEqual([4, 5]);

    const people = await asTenant(a.organisationId, (tx) => tx.person.findMany({ orderBy: { email: "asc" } }));
    expect(people.map((p) => [p.email, p.firstName, p.lastName, p.title, p.custom])).toEqual([
      ["kabo@example.com", "Kabo", "Moremi", "Driver", { pronouns: "he/him" }],
      ["lesedi@example.com", "Lesedi", "Molefe", "Head of Operations", { pronouns: "she/her" }],
    ]);
  });

  it("keeps people, kits, templates and images inside their organisation", async () => {
    await savePerson(ctxB(), null, { email: `b-${tag()}@example.com`, firstName: "Bravo" });
    const t = await createTemplate(ctxB(), { name: "Bravo signature", kind: "VISUAL", starterKey: "general-everyday" });
    await asTenant(a.organisationId, async (tx) => {
      expect(await tx.person.count({ where: { organisationId: b.organisationId } })).toBe(0);
      expect(await tx.signatureTemplate.findUnique({ where: { id: t.id } })).toBeNull();
      expect(await tx.brandKit.count({ where: { organisationId: b.organisationId } })).toBe(0);
      expect(await tx.asset.count({ where: { organisationId: b.organisationId } })).toBe(0);
    });
    // Working on another organisation's template by id finds nothing.
    await expect(publishTemplate(ctxA(), t.id)).rejects.toMatchObject({ code: "not-found" });
    expect(await db.person.count()).toBe(0);
    expect(await db.signatureTemplate.count()).toBe(0);
  });

  it("serves an uploaded logo publicly by its random id, re-encoded", async () => {
    const kit = await asTenant(a.organisationId, (tx) => ensureDefaultKit(tx, a.organisationId));
    await setKitLogo(ctxA(), kit.id, await png());
    const withLogo = await asTenant(a.organisationId, (tx) => tx.brandKit.findFirstOrThrow({ where: { id: kit.id }, include: { logo: true } }));
    expect(withLogo.logo).toMatchObject({ kind: "LOGO", width: 400, height: 200, contentType: "image/png" });
    expect(withLogo.logo!.id).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const served = await readPublicAsset(withLogo.logo!.id);
    expect(served?.contentType).toBe("image/png");
    expect(await readPublicAsset("short")).toBeNull();
    await expect(setKitLogo(ctxA(), kit.id, Buffer.from("not an image"))).rejects.toMatchObject({ code: "invalid" });
  });

  it("publishes immutable versions and renders a person's signature from the live one", async () => {
    const kit = await asTenant(a.organisationId, (tx) => ensureDefaultKit(tx, a.organisationId));
    await updateKit(ctxA(), kit.id, { name: kit.name, data: { ...kitData(kit), company: "Kalahari Freight", website: "kalahari.example" } });
    const t = await createTemplate(ctxA(), { name: "Everyday", kind: "VISUAL", starterKey: "general-everyday" });
    expect(t.publishedVersionId).toBeNull();
    const v1 = await publishTemplate(ctxA(), t.id);
    expect(v1.number).toBe(1);

    const person = await asTenant(a.organisationId, (tx) => tx.person.findFirstOrThrow({ where: { email: "lesedi@example.com" } }));
    const before = await asTenant(a.organisationId, (tx) => renderForPerson(tx, a.organisationId, t.id, person.id, ORIGIN));
    expect(before?.html).toContain("Lesedi Molefe");
    expect(before?.html).toContain("Kalahari Freight");

    // An unpublished edit doesn't reach anyone until it's published.
    const block = { ...newBlock("text"), text: "Draft only {{firstName}}" };
    await saveDraft(ctxA(), t.id, { content: { ...emptyDoc(), blocks: [block] } });
    const still = await asTenant(a.organisationId, (tx) => renderForPerson(tx, a.organisationId, t.id, person.id, ORIGIN));
    expect(still?.html).not.toContain("Draft only");
    const v2 = await publishTemplate(ctxA(), t.id);
    expect(v2.number).toBe(2);
    const after = await asTenant(a.organisationId, (tx) => renderForPerson(tx, a.organisationId, t.id, person.id, ORIGIN));
    expect(after?.html).toContain("Draft only Lesedi");
    // The first version is still there, unchanged.
    const old = await asTenant(a.organisationId, (tx) => tx.signatureVersion.findUniqueOrThrow({ where: { id: v1.id } }));
    expect(JSON.stringify(old.content)).not.toContain("Draft only");

    const audit = await asTenant(a.organisationId, (tx) => tx.auditLog.findMany({ where: { action: "template.published" } }));
    expect(audit).toHaveLength(2);
  });

  it("cleans HTML mode signatures when saved", async () => {
    const t = await createTemplate(ctxA(), { name: "Raw HTML", kind: "HTML" });
    await saveDraft(ctxA(), t.id, { content: { html: '<table><tr><td>{{fullName}}<script>alert(1)</script><a href="javascript:alert(1)">x</a></td></tr></table>' } });
    const saved = await asTenant(a.organisationId, (tx) => tx.signatureTemplate.findUniqueOrThrow({ where: { id: t.id } }));
    const html = (saved.draft as { html: string }).html;
    expect(html).not.toMatch(/script|javascript/i);
    expect(html).toContain("{{fullName}}");
  });

  it("gives each person the most specific published signature, for new emails and replies", async () => {
    const everyone = await createTemplate(ctxA(), { name: "Everyone", kind: "VISUAL", starterKey: "general-everyday" });
    const ops = await createTemplate(ctxA(), { name: "Operations", kind: "VISUAL", starterKey: "general-everyday" });
    const replies = await createTemplate(ctxA(), { name: "Short reply", kind: "VISUAL", starterKey: "general-everyday" });
    const unpublished = await createTemplate(ctxA(), { name: "Not live", kind: "VISUAL", starterKey: "general-everyday" });
    for (const t of [everyone, ops, replies]) await publishTemplate(ctxA(), t.id);

    const [lesedi, kabo] = await asTenant(a.organisationId, (tx) =>
      Promise.all(["lesedi@example.com", "kabo@example.com"].map((email) => tx.person.findFirstOrThrow({ where: { email } }))),
    );
    await addAssignment(ctxA(), { templateId: everyone.id, scope: "EVERYONE", forNew: true, forReply: true });
    await addAssignment(ctxA(), { templateId: ops.id, scope: "DEPARTMENT", department: "operations", forNew: true, forReply: false });
    await addAssignment(ctxA(), { templateId: replies.id, scope: "PERSON", personId: lesedi.id, forNew: false, forReply: true });
    await addAssignment(ctxA(), { templateId: unpublished.id, scope: "PERSON", personId: kabo.id, forNew: true, forReply: true });
    await expect(addAssignment(ctxA(), { templateId: everyone.id, scope: "EVERYONE", forNew: false, forReply: false })).rejects.toMatchObject({ code: "invalid" });

    const rules = await asTenant(a.organisationId, (tx) => liveRules(tx));
    expect(resolveAssignments(lesedi, rules)).toEqual({ newEmail: ops.id, reply: replies.id, all: [replies.id, ops.id, everyone.id] });
    // Kabo's own rule points at an unpublished template, so it doesn't count.
    expect(resolveAssignments(kabo, rules)).toEqual({ newEmail: everyone.id, reply: everyone.id, all: [everyone.id] });

    await setArchived(ctxA(), ops.id, true);
    const afterArchive = await asTenant(a.organisationId, (tx) => liveRules(tx));
    expect(resolveAssignments(lesedi, afterArchive).newEmail).toBe(everyone.id);
  });

  it("lets only the right roles change signatures and the directory", async () => {
    await expect(createTemplate(ctxA("READ_ONLY"), { name: "Nope", kind: "VISUAL" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(createTemplate(ctxA("ANALYST"), { name: "Nope", kind: "VISUAL" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(savePerson(ctxA("TEMPLATE_MANAGER"), null, { email: `tm-${tag()}@example.com`, firstName: "Tee" })).rejects.toMatchObject({ code: "forbidden" });
    const t = await createTemplate(ctxA("TEMPLATE_MANAGER"), { name: "Allowed", kind: "VISUAL" });
    expect(t.name).toBe("Allowed");
    await savePerson(ctxA("ADMIN"), null, { email: `admin-${tag()}@example.com`, firstName: "Ada" });
  });
});

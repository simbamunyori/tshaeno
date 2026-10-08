import type { AssignmentScope, Audience, Prisma, PrismaClient, SignatureTemplate, TemplateKind } from "@prisma/client";
import { asTenant, type Tx } from "@/server/db";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { emptyDoc, parseDoc, reId } from "@/lib/signature/doc";
import { renderHtmlSignature, sanitizeSignatureHtml } from "@/lib/signature/html-mode";
import { renderSignature, type Rendered } from "@/lib/signature/render";
import { describeRule, type Rule } from "@/lib/signature/rules";
import { HTML_STARTER, starter } from "@/lib/signature/starters";
import type { ImageRef, SignatureDoc, TemplateContent } from "@/lib/signature/types";
import { imageRef } from "./assets";
import { kitFor, toBrandData } from "./brand";
import { PHOTO_SELECT, toPersonData } from "./people";

export { SCOPE_RANK, resolveAssignments, type ResolvedSignatures } from "@/lib/signature/rules";

/**
 * Signature templates. Each has a working draft that the studio saves
 * as you go, and published versions; people's signatures always use the
 * latest published version, so half-finished edits never reach anyone.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });

export const MAX_HTML = 50_000;

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n || n.length > 80) throw new DomainError("invalid", "Enter a name under 80 characters.", "name");
  return n;
}

/** Checks what the studio sent and returns what may be stored. */
export function cleanContent(kind: TemplateKind, input: unknown): Prisma.InputJsonValue {
  if (kind === "VISUAL") {
    try {
      return parseDoc(input) as unknown as Prisma.InputJsonValue;
    } catch {
      throw new DomainError("invalid", "The signature couldn't be saved because part of it is malformed. Reload and try again.");
    }
  }
  const html = typeof input === "object" && input && "html" in input ? String((input as { html: unknown }).html ?? "") : "";
  if (html.length > MAX_HTML) throw new DomainError("invalid", `Keep the HTML under ${MAX_HTML.toLocaleString("en")} characters.`);
  return { html: sanitizeSignatureHtml(html) };
}

export function contentOf(kind: TemplateKind, stored: unknown): TemplateContent {
  if (kind === "HTML") return { kind, html: String((stored as { html?: string })?.html ?? "") };
  return { kind, doc: stored as SignatureDoc };
}

export async function createTemplate(ctx: Ctx, input: { name: string; kind: TemplateKind; starterKey?: string | null; brandKitId?: string | null }) {
  assertCan(ctx.actor, "manageTemplates");
  const name = cleanName(input.name);
  const s = input.starterKey ? starter(input.starterKey) : undefined;
  if (input.starterKey && !s) throw new DomainError("not-found", "That starter template doesn't exist.");
  const draft: Prisma.InputJsonValue =
    input.kind === "HTML" ? { html: HTML_STARTER } : ((s ? reId(s.doc) : emptyDoc()) as unknown as Prisma.InputJsonValue);
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const kit = input.brandKitId ? await tx.brandKit.findFirst({ where: { id: input.brandKitId }, select: { id: true } }) : null;
      const t = await tx.signatureTemplate.create({
        data: { organisationId: ctx.organisationId, name, kind: input.kind, draft, starterKey: s?.key ?? null, brandKitId: kit?.id ?? null },
      });
      await audit(tx, ctx.organisationId, who(ctx.actor), "template.created", { type: "SignatureTemplate", id: t.id }, { name, starter: s?.key ?? null }, ctx.ipAddress);
      return t;
    },
    ctx.db,
  );
}

async function find(tx: Tx, templateId: string): Promise<SignatureTemplate> {
  const t = await tx.signatureTemplate.findFirst({ where: { id: templateId } });
  if (!t) throw new DomainError("not-found", "That signature doesn't exist.");
  return t;
}

export async function saveDraft(ctx: Ctx, templateId: string, input: { content: unknown; name?: string; brandKitId?: string | null }) {
  assertCan(ctx.actor, "manageTemplates");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const t = await find(tx, templateId);
      if (t.archivedAt) throw new DomainError("conflict", "This signature is archived. Restore it to edit it.");
      const draft = cleanContent(t.kind, input.content);
      let brandKitId = t.brandKitId;
      if (input.brandKitId !== undefined) {
        brandKitId = input.brandKitId ? ((await tx.brandKit.findFirst({ where: { id: input.brandKitId }, select: { id: true } }))?.id ?? null) : null;
      }
      const name = input.name !== undefined ? cleanName(input.name) : t.name;
      // Saving a draft happens often, so it isn't audited; publishing is.
      return tx.signatureTemplate.update({ where: { id: t.id }, data: { draft, name, brandKitId }, select: { updatedAt: true } });
    },
    ctx.db,
  );
}

export async function publishTemplate(ctx: Ctx, templateId: string) {
  assertCan(ctx.actor, "manageTemplates");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const t = await find(tx, templateId);
      if (t.archivedAt) throw new DomainError("conflict", "This signature is archived. Restore it first.");
      const last = await tx.signatureVersion.findFirst({ where: { templateId: t.id }, orderBy: { number: "desc" }, select: { number: true } });
      const number = (last?.number ?? 0) + 1;
      const v = await tx.signatureVersion.create({
        data: { organisationId: ctx.organisationId, templateId: t.id, number, kind: t.kind, content: cleanContent(t.kind, t.draft), createdById: ctx.actor.userId },
      });
      await tx.signatureTemplate.update({ where: { id: t.id }, data: { publishedVersionId: v.id } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "template.published", { type: "SignatureTemplate", id: t.id }, { name: t.name, version: number }, ctx.ipAddress);
      return v;
    },
    ctx.db,
  );
}

export async function duplicateTemplate(ctx: Ctx, templateId: string) {
  assertCan(ctx.actor, "manageTemplates");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const t = await find(tx, templateId);
      const draft = t.kind === "VISUAL" ? (reId(t.draft as unknown as SignatureDoc) as unknown as Prisma.InputJsonValue) : (t.draft as Prisma.InputJsonValue);
      const copy = await tx.signatureTemplate.create({
        data: { organisationId: ctx.organisationId, name: `${t.name} (copy)`.slice(0, 80), kind: t.kind, draft, starterKey: t.starterKey, brandKitId: t.brandKitId },
      });
      await audit(tx, ctx.organisationId, who(ctx.actor), "template.created", { type: "SignatureTemplate", id: copy.id }, { name: copy.name, copyOf: t.id }, ctx.ipAddress);
      return copy;
    },
    ctx.db,
  );
}

export async function setArchived(ctx: Ctx, templateId: string, archived: boolean) {
  assertCan(ctx.actor, "manageTemplates");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const t = await find(tx, templateId);
      if (!!t.archivedAt === archived) return;
      await tx.signatureTemplate.update({ where: { id: t.id }, data: { archivedAt: archived ? new Date() : null } });
      await audit(tx, ctx.organisationId, who(ctx.actor), archived ? "template.archived" : "template.restored", { type: "SignatureTemplate", id: t.id }, { name: t.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

// ─── Assignments ───────────────────────────────────────────────────

export async function addAssignment(
  ctx: Ctx,
  input: {
    templateId: string;
    scope: AssignmentScope;
    department?: string;
    groupName?: string;
    location?: string;
    personId?: string;
    forNew: boolean;
    forReply: boolean;
    audience?: Audience;
  },
) {
  assertCan(ctx.actor, "manageTemplates");
  if (!input.forNew && !input.forReply) throw new DomainError("invalid", "Choose new emails, replies, or both.", "usage");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const t = await find(tx, input.templateId);
      const value = (v: string | undefined, field: string, what: string) => {
        const out = (v ?? "").trim().replace(/\s+/g, " ");
        if (!out || out.length > 200) throw new DomainError("invalid", `Choose ${what}.`, field);
        return out;
      };
      const data = {
        department: input.scope === "DEPARTMENT" ? value(input.department, "department", "a department") : null,
        groupName: input.scope === "GROUP" ? value(input.groupName, "groupName", "a group") : null,
        location: input.scope === "LOCATION" ? value(input.location, "location", "a location") : null,
        personId: null as string | null,
      };
      let personLabel: string | undefined;
      if (input.scope === "PERSON") {
        const p = await tx.person.findFirst({ where: { id: input.personId ?? "" }, select: { id: true, email: true } });
        if (!p) throw new DomainError("invalid", "Choose a person.", "personId");
        data.personId = p.id;
        personLabel = p.email;
      }
      const audience = input.audience ?? "ANY";
      const a = await tx.signatureAssignment.create({
        data: { organisationId: ctx.organisationId, templateId: t.id, scope: input.scope, ...data, forNew: input.forNew, forReply: input.forReply, audience },
      });
      const described = describeRule(a, personLabel);
      await audit(tx, ctx.organisationId, who(ctx.actor), "template.assigned", { type: "SignatureTemplate", id: t.id }, { name: t.name, to: described.who, when: described.when }, ctx.ipAddress);
      return a;
    },
    ctx.db,
  );
}

export async function removeAssignment(ctx: Ctx, assignmentId: string) {
  assertCan(ctx.actor, "manageTemplates");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const a = await tx.signatureAssignment.findFirst({ where: { id: assignmentId }, include: { template: true } });
      if (!a) throw new DomainError("not-found", "That rule no longer exists.");
      await tx.signatureAssignment.delete({ where: { id: a.id } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "template.unassigned", { type: "SignatureTemplate", id: a.templateId }, { name: a.template.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function liveRules(tx: Tx): Promise<Rule[]> {
  return tx.signatureAssignment.findMany({
    where: { template: { archivedAt: null, publishedVersionId: { not: null } } },
    select: { templateId: true, scope: true, department: true, groupName: true, location: true, personId: true, forNew: true, forReply: true, audience: true, createdAt: true },
  });
}

// ─── Rendering ─────────────────────────────────────────────────────

/** Uploaded images a document uses, keyed by asset id. */
export async function assetsFor(tx: Tx, doc: SignatureDoc, origin: string): Promise<Record<string, ImageRef>> {
  const ids = new Set<string>();
  const walk = (blocks: SignatureDoc["blocks"]) => {
    for (const b of blocks) {
      if ((b.type === "image" || b.type === "banner") && b.assetId) ids.add(b.assetId);
      if (b.type === "columns") walk([...b.left, ...b.right]);
    }
  };
  walk(doc.blocks ?? []);
  if (!ids.size) return {};
  const rows = await tx.asset.findMany({ where: { id: { in: [...ids] } }, select: { id: true, contentType: true, width: true, height: true } });
  return Object.fromEntries(rows.map((r) => [r.id, imageRef(origin, r)!]));
}

/** One person's signature from one template's published version. */
export async function renderForPerson(tx: Tx, organisationId: string, templateId: string, personId: string, origin: string): Promise<Rendered | null> {
  const t = await tx.signatureTemplate.findFirst({ where: { id: templateId }, include: { published: true } });
  const person = await tx.person.findFirst({ where: { id: personId }, include: PHOTO_SELECT });
  if (!t?.published || !person) return null;
  const kit = await kitFor(tx, organisationId, t.brandKitId);
  const brand = toBrandData(kit, origin);
  const content = contentOf(t.published.kind, t.published.content);
  if (content.kind === "HTML") return renderHtmlSignature(content.html, { brand, person: toPersonData(person, origin) });
  return renderSignature(content.doc, { brand, person: toPersonData(person, origin), assets: await assetsFor(tx, content.doc, origin), origin });
}

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { docSchema } from "@/lib/signature/doc";
import { checkBrand, type BrandFinding } from "@/lib/signature/brand-check";
import { FIELDS } from "@/lib/signature/fields";
import type { Block, SignatureDoc } from "@/lib/signature/types";
import { asTenant } from "@/server/db";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { kitFor, toBrandData } from "@/server/signatures/brand";
import { contentOf, createTemplate } from "@/server/signatures/templates";
import { askForTool, claude, plainCopy, type Claude } from "./claude";

/**
 * Claude helping with signatures: drafting a template from a description,
 * and reviewing published ones against the brand. Claude only ever sees
 * the brand kit and the templates, never anyone's details.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

const COPY_RULES = "Write in plain, friendly British English. Never use exclamation marks or em dashes.";

function need(c: Claude | null): Claude {
  if (!c) throw new DomainError("conflict", "Claude isn't set up on this Tshaeno server.");
  return c;
}

/** Without uploaded pictures to point at, drop blocks that would need one. */
function withoutUploads(blocks: Block[]): Block[] {
  return blocks
    .filter((b) => !(b.type === "banner" || (b.type === "image" && b.source === "asset")))
    .map((b) => (b.type === "columns" ? { ...b, left: withoutUploads(b.left) as typeof b.left, right: withoutUploads(b.right) as typeof b.right } : b));
}

const DRAFT_SYSTEM = `You design email signatures for Tshaeno, a signature manager. You answer by calling the "signature" tool with a document the Tshaeno studio can open.

How documents work:
- A document has a width (380 to 600 pixels suits most), a base text size (12 to 14 suits most) and a list of blocks, top to bottom.
- A "columns" block puts blocks side by side, for example a logo or photo on the left and the details on the right. Columns can't be nested.
- Text blocks hold plain text with fields in double braces, which are filled in for each person: ${FIELDS.map((f) => `{{${f.key}}} (${f.label})`).join(", ")}. Lines with only empty fields disappear, so it is safe to use fields some people lack.
- Colours are "primary", "secondary", "text" or "muted" from the brand kit. Prefer these; use a hex colour only when the description asks for one.
- Image blocks show the brand's "logo" or the person's "photo". Don't use uploaded images or banner blocks.
- "contacts" lists phone, mobile, email, website and address with icons, letters or no labels. "socials" shows the brand's social icons. "disclaimer" shows the brand's legal text.
- Block ids are short letters and digits, unique in the document.

Good signatures are calm and easy to scan: the name stands out, the title sits under it, contact details are small and muted, and there is one accent colour. Keep it under about 12 blocks. Give the template a short name of two to four words. ${COPY_RULES}`;

const DraftAnswer = z.object({ name: z.string().trim().min(1).max(60), doc: docSchema });

/** A new draft template from a description, in the chosen brand kit. Opens in the studio like any other. */
export async function draftTemplate(ctx: Ctx, input: { description: string; brandKitId?: string | null }, c: Claude | null = claude()) {
  assertCan(ctx.actor, "manageTemplates");
  const description = input.description.trim();
  if (description.length < 10) throw new DomainError("invalid", "Say a little more about the signature you want.", "description");
  if (description.length > 1500) throw new DomainError("invalid", "Keep the description under 1,500 characters.", "description");
  const brand = await asTenant(ctx.organisationId, async (tx) => toBrandData(await kitFor(tx, ctx.organisationId, input.brandKitId), ""), ctx.db);
  const prompt = [
    `The brand: ${brand.company || "an organisation"}.`,
    `Colours: primary ${brand.colours.primary}, secondary ${brand.colours.secondary}, text ${brand.colours.text}, muted ${brand.colours.muted}. Font: ${brand.font}.`,
    `It ${brand.logo ? "has" : "has no"} logo, ${brand.socials.length ? `social links (${brand.socials.map((s) => s.network).join(", ")})` : "no social links"}, and ${brand.disclaimer.trim() ? "a disclaimer" : "no disclaimer"}.`,
    "",
    `What they asked for: ${description}`,
  ].join("\n");
  const answer = await askForTool(need(c), { system: DRAFT_SYSTEM, prompt, tool: { name: "signature", description: "The signature template to create.", schema: DraftAnswer }, maxTokens: 6000 });
  const doc: SignatureDoc = { ...(answer.doc as SignatureDoc), blocks: withoutUploads((answer.doc as SignatureDoc).blocks) };
  if (!doc.blocks.length) throw new DomainError("conflict", "Claude's answer didn't come out right. Try again, or say it a little differently.");
  return createTemplate(ctx, { name: plainCopy(answer.name), kind: "VISUAL", brandKitId: input.brandKitId ?? null, doc, draftedBy: "Claude" });
}

const REVIEW_SYSTEM = `You review an organisation's published email signatures for brand consistency, as part of Tshaeno, a signature manager. You answer by calling the "review" tool.

Look for what a careful brand manager would notice across the signatures: colours, sizes and fonts that drift between templates, names or titles styled differently, inconsistent order of details, missing logo or disclaimer where others have them, too much text, cluttered layouts, or anything likely to look broken in Outlook or Gmail. Compare the templates with each other and with the brand kit.

The automatic checks already found the items listed under "Already found". Don't repeat them. Give at most 6 findings, most important first. Each names the template it is about (or none, when it is about all of them) and says plainly what to change, in one or two sentences. If everything looks consistent, give no findings. ${COPY_RULES}`;

const ReviewAnswer = z.object({
  findings: z
    .array(z.object({ severity: z.enum(["warning", "note"]), template: z.string().max(80).nullable(), message: z.string().min(1).max(400) }))
    .max(6),
});

/** Claude's second look at brand consistency, on top of the automatic checks. Nothing is stored. */
export async function reviewBrand(ctx: Ctx, c: Claude | null = claude()): Promise<BrandFinding[]> {
  assertCan(ctx.actor, "viewAnalytics");
  const data = await asTenant(
    ctx.organisationId,
    async (tx) => {
      const templates = await tx.signatureTemplate.findMany({ where: { archivedAt: null, publishedVersionId: { not: null } }, include: { published: true } });
      return Promise.all(
        templates
          .filter((t) => t.published)
          .map(async (t) => {
            const b = toBrandData(await kitFor(tx, ctx.organisationId, t.brandKitId), "");
            return { name: t.name, content: contentOf(t.published!.kind, t.published!.content), brand: b };
          }),
      );
    },
    ctx.db,
  );
  if (!data.length) throw new DomainError("conflict", "Publish a signature first, then ask for a review.");
  const already = checkBrand(
    data.map((t) => ({ name: t.name, content: t.content, brand: { colours: t.brand.colours, hasLogo: !!t.brand.logo, hasDisclaimer: !!t.brand.disclaimer.trim() } })),
    { people: 0, noTitle: 0, noPhone: 0 },
  );
  const describe = (t: (typeof data)[number]) =>
    [
      `## ${t.name}`,
      `Brand kit: ${t.brand.company || "unnamed"}, colours ${JSON.stringify(t.brand.colours)}, font ${t.brand.font}, ${t.brand.logo ? "with" : "without"} a logo, ${t.brand.disclaimer.trim() ? "with" : "without"} a disclaimer.`,
      t.content.kind === "VISUAL" ? `Studio document:\n${JSON.stringify(t.content.doc)}` : `HTML:\n${t.content.html.slice(0, 8000)}`,
    ].join("\n");
  const prompt = [
    ...data.slice(0, 12).map(describe),
    "",
    "Already found:",
    ...(already.length ? already.map((f) => `- ${f.template ?? "All"}: ${f.message}`) : ["- Nothing."]),
  ].join("\n\n");
  const answer = await askForTool(need(c), { system: REVIEW_SYSTEM, prompt, tool: { name: "review", description: "Your findings.", schema: ReviewAnswer }, maxTokens: 2000 });
  await asTenant(ctx.organisationId, (tx) => audit(tx, ctx.organisationId, { userId: ctx.actor.userId, name: ctx.actor.name }, "brand.reviewed_by_claude", { type: "Organisation", id: ctx.organisationId }, { findings: answer.findings.length }, ctx.ipAddress), ctx.db);
  const names = new Set(data.map((t) => t.name));
  return answer.findings.map((f) => ({ severity: f.severity, template: f.template && names.has(f.template) ? f.template : null, message: plainCopy(f.message) }));
}

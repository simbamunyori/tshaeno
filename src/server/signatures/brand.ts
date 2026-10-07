import type { BrandKit, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { asTenant, type Tx } from "@/server/db";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { FONT_KEYS } from "@/lib/signature/style";
import { safeHref } from "@/lib/signature/style";
import type { BrandData, FontKey, SocialLink, SocialNetwork } from "@/lib/signature/types";
import { imageRef, processImage, saveAsset } from "./assets";

/**
 * Brand kits: the colours, font, logo, company details, disclaimer and
 * social links a signature uses. An organisation can have several (for
 * example one per sub-brand); one is the default.
 */

export const SOCIALS: SocialNetwork[] = ["linkedin", "x", "facebook", "instagram", "youtube", "tiktok", "github", "whatsapp", "threads"];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0B7F78.");

export const brandKitDataSchema = z.object({
  colours: z.object({ primary: hex, secondary: hex, text: hex, muted: hex }),
  font: z.enum(FONT_KEYS as [FontKey, ...FontKey[]]),
  company: z.string().trim().max(120),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => !v || !!safeHref(v), "Enter a web address like example.com."),
  address: z.string().trim().max(200),
  disclaimer: z.string().trim().max(1500),
  socials: z
    .array(
      z.object({
        network: z.enum(SOCIALS as [SocialNetwork, ...SocialNetwork[]]),
        url: z
          .string()
          .trim()
          .max(300)
          .refine((v) => !!safeHref(v), "Enter a full link."),
      }),
    )
    .max(SOCIALS.length),
});

export type BrandKitData = z.infer<typeof brandKitDataSchema>;

export function defaultKitData(company: string): BrandKitData {
  return {
    colours: { primary: "#0B7F78", secondary: "#2EC4B6", text: "#0B1F3A", muted: "#5A6472" },
    font: "arial",
    company,
    website: "",
    address: "",
    disclaimer: "",
    socials: [],
  };
}

/** Reads stored data, filling anything missing from older rows. */
export function kitData(kit: Pick<BrandKit, "data">, company = ""): BrandKitData {
  const parsed = brandKitDataSchema.safeParse(kit.data);
  if (parsed.success) return parsed.data;
  const raw = (kit.data ?? {}) as Partial<BrandKitData>;
  const d = defaultKitData(company);
  return { ...d, ...raw, colours: { ...d.colours, ...(raw.colours ?? {}) }, socials: Array.isArray(raw.socials) ? (raw.socials as SocialLink[]) : [] };
}

type KitWithLogo = BrandKit & { logo: { id: string; contentType: string; width: number; height: number } | null };

export function toBrandData(kit: KitWithLogo, origin: string): BrandData {
  const d = kitData(kit);
  return { ...d, website: d.website, logo: imageRef(origin, kit.logo) };
}

const LOGO_SELECT = { logo: { select: { id: true, contentType: true, width: true, height: true } } } as const;

/** The default kit, made on first use from the organisation's name. */
export async function ensureDefaultKit(tx: Tx, organisationId: string): Promise<KitWithLogo> {
  const existing = await tx.brandKit.findFirst({ where: { isDefault: true }, include: LOGO_SELECT });
  if (existing) return existing;
  const any = await tx.brandKit.findFirst({ orderBy: { createdAt: "asc" }, include: LOGO_SELECT });
  if (any) return tx.brandKit.update({ where: { id: any.id }, data: { isDefault: true }, include: LOGO_SELECT });
  const org = await tx.organisation.findUniqueOrThrow({ where: { id: organisationId } });
  return tx.brandKit.create({
    data: { organisationId, name: "Main brand", isDefault: true, data: defaultKitData(org.name) },
    include: LOGO_SELECT,
  });
}

export async function kitFor(tx: Tx, organisationId: string, brandKitId: string | null | undefined): Promise<KitWithLogo> {
  if (brandKitId) {
    const kit = await tx.brandKit.findFirst({ where: { id: brandKitId }, include: LOGO_SELECT });
    if (kit) return kit;
  }
  return ensureDefaultKit(tx, organisationId);
}

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n || n.length > 80) throw new DomainError("invalid", "Enter a name under 80 characters.", "name");
  return n;
}

export async function createKit(ctx: Ctx, name: string) {
  assertCan(ctx.actor, "manageTemplates");
  const clean = cleanName(name);
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const base = await ensureDefaultKit(tx, ctx.organisationId);
      const kit = await tx.brandKit.create({
        data: { organisationId: ctx.organisationId, name: clean, data: kitData(base), logoAssetId: base.logoAssetId },
      });
      await audit(tx, ctx.organisationId, who(ctx.actor), "brand.created", { type: "BrandKit", id: kit.id }, { name: clean }, ctx.ipAddress);
      return kit;
    },
    ctx.db,
  );
}

export async function updateKit(ctx: Ctx, kitId: string, input: { name: string; data: unknown }) {
  assertCan(ctx.actor, "manageTemplates");
  const name = cleanName(input.name);
  const parsed = brandKitDataSchema.safeParse(input.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new DomainError("invalid", first?.message ?? "Check the brand kit.", first?.path.join("."));
  }
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const kit = await tx.brandKit.findFirst({ where: { id: kitId } });
      if (!kit) throw new DomainError("not-found", "That brand kit doesn't exist.");
      await tx.brandKit.update({ where: { id: kit.id }, data: { name, data: parsed.data } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "brand.updated", { type: "BrandKit", id: kit.id }, { name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function setKitLogo(ctx: Ctx, kitId: string, file: Buffer | null) {
  assertCan(ctx.actor, "manageTemplates");
  const img = file ? await processImage(file, "LOGO") : null;
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const kit = await tx.brandKit.findFirst({ where: { id: kitId } });
      if (!kit) throw new DomainError("not-found", "That brand kit doesn't exist.");
      const asset = img ? await saveAsset(tx, ctx.organisationId, "LOGO", img) : null;
      await tx.brandKit.update({ where: { id: kit.id }, data: { logoAssetId: asset?.id ?? null } });
      await audit(tx, ctx.organisationId, who(ctx.actor), asset ? "brand.logo_changed" : "brand.logo_removed", { type: "BrandKit", id: kit.id }, undefined, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function makeDefaultKit(ctx: Ctx, kitId: string) {
  assertCan(ctx.actor, "manageTemplates");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const kit = await tx.brandKit.findFirst({ where: { id: kitId } });
      if (!kit) throw new DomainError("not-found", "That brand kit doesn't exist.");
      if (kit.isDefault) return;
      await tx.brandKit.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      await tx.brandKit.update({ where: { id: kit.id }, data: { isDefault: true } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "brand.made_default", { type: "BrandKit", id: kit.id }, { name: kit.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function deleteKit(ctx: Ctx, kitId: string) {
  assertCan(ctx.actor, "manageTemplates");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const kit = await tx.brandKit.findFirst({ where: { id: kitId } });
      if (!kit) throw new DomainError("not-found", "That brand kit doesn't exist.");
      if (kit.isDefault) throw new DomainError("conflict", "Make another kit the default before deleting this one.");
      // Templates using it fall back to the default kit.
      await tx.brandKit.delete({ where: { id: kit.id } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "brand.deleted", { type: "BrandKit", id: kit.id }, { name: kit.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

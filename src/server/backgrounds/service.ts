import type { MeetingBackground, PrismaClient } from "@prisma/client";
import type { Style } from "@/lib/backgrounds/draw";
import { requirePremium } from "@/server/billing/premium";
import { asTenant, type Tx } from "@/server/db";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { assetUrl, processImage, saveAsset } from "@/server/signatures/assets";
import { kitFor, toBrandData } from "@/server/signatures/brand";

/**
 * Meeting backgrounds an admin designs once. Everyone gets their own copy
 * with their name and title, drawn in their browser and downloaded from
 * their own page, so there's nothing to render or store per person.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });
const STYLES: Style[] = ["panel", "light", "band", "photo"];

export interface BackgroundInput {
  name: string;
  style: string;
  colour: string;
  brandKitId: string | null;
  showName: boolean;
  showTitle: boolean;
  published: boolean;
}

/** What the browser needs to draw a background: everything but the person. */
export interface BackgroundDesign {
  id: string;
  name: string;
  style: Style;
  colour: string;
  company: string;
  logoUrl: string | null;
  photoUrl: string | null;
  showName: boolean;
  showTitle: boolean;
  published: boolean;
  brandKitId: string | null;
}

function clean(input: BackgroundInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) throw new DomainError("invalid", "Give it a name under 60 characters.", "name");
  if (!STYLES.includes(input.style as Style)) throw new DomainError("invalid", "Choose a style.", "style");
  if (!/^#[0-9a-f]{6}$/i.test(input.colour)) throw new DomainError("invalid", "Choose a colour.", "colour");
  return { name, style: input.style, colour: input.colour.toUpperCase(), brandKitId: input.brandKitId || null, showName: input.showName, showTitle: input.showTitle, published: input.published };
}

type Row = MeetingBackground & { image: { id: string; contentType: string; width: number; height: number } | null };

async function design(tx: Tx, organisationId: string, b: Row, origin: string): Promise<BackgroundDesign> {
  const brand = toBrandData(await kitFor(tx, organisationId, b.brandKitId), origin);
  return {
    id: b.id,
    name: b.name,
    style: STYLES.includes(b.style as Style) ? (b.style as Style) : "panel",
    colour: b.colour,
    company: brand.company,
    logoUrl: brand.logo?.url ?? null,
    photoUrl: b.image ? assetUrl(origin, b.image) : null,
    showName: b.showName,
    showTitle: b.showTitle,
    published: b.published,
    brandKitId: b.brandKitId,
  };
}

const IMAGE = { image: { select: { id: true, contentType: true, width: true, height: true } } } as const;

/** Every background, or only the ones people can download. */
export async function backgrounds(tx: Tx, organisationId: string, origin: string, onlyPublished = false): Promise<BackgroundDesign[]> {
  const rows = await tx.meetingBackground.findMany({ where: onlyPublished ? { published: true } : {}, include: IMAGE, orderBy: { createdAt: "asc" } });
  return Promise.all(rows.map((b) => design(tx, organisationId, b, origin)));
}

export async function saveBackground(ctx: Ctx, backgroundId: string | null, input: BackgroundInput, image: Buffer | null) {
  assertCan(ctx.actor, "manageTemplates");
  const data = clean(input);
  const img = image ? await processImage(image, "BACKDROP") : null;
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      await requirePremium(tx, ctx.organisationId, "backgrounds");
      const before = backgroundId ? await tx.meetingBackground.findFirst({ where: { id: backgroundId } }) : null;
      if (backgroundId && !before) throw new DomainError("not-found", "That background doesn't exist.");
      if (data.brandKitId && !(await tx.brandKit.findFirst({ where: { id: data.brandKitId }, select: { id: true } }))) {
        throw new DomainError("invalid", "Choose one of your brand kits.", "brandKitId");
      }
      if (data.style === "photo" && !img && !before?.imageAssetId) throw new DomainError("invalid", "Choose the picture to use.", "file");
      const asset = img ? await saveAsset(tx, ctx.organisationId, "BACKDROP", img) : null;
      const fields = { ...data, ...(asset ? { imageAssetId: asset.id } : {}) };
      const b = before
        ? await tx.meetingBackground.update({ where: { id: before.id }, data: fields })
        : await tx.meetingBackground.create({ data: { ...fields, organisationId: ctx.organisationId } });
      await audit(tx, ctx.organisationId, who(ctx.actor), before ? "background.changed" : "background.created", { type: "MeetingBackground", id: b.id }, { name: b.name }, ctx.ipAddress);
      return b;
    },
    ctx.db,
  );
}

export async function deleteBackground(ctx: Ctx, backgroundId: string) {
  assertCan(ctx.actor, "manageTemplates");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const b = await tx.meetingBackground.findFirst({ where: { id: backgroundId } });
      if (!b) return;
      await tx.meetingBackground.delete({ where: { id: b.id } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "background.deleted", { type: "MeetingBackground", id: b.id }, { name: b.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

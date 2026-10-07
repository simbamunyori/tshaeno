import "server-only";
import type { PrismaClient } from "@prisma/client";
import { asTenant, type Tx } from "@/server/db";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { appOrigin } from "@/server/env";
import type { BrandData, ImageRef, PersonData } from "@/lib/signature/types";
import { imageRef, processImage, saveAsset } from "./assets";
import { ensureDefaultKit, toBrandData } from "./brand";
import { PHOTO_SELECT, toPersonData } from "./people";

/** What the studio and previews need to draw signatures in the browser. */

export interface KitOption {
  id: string;
  name: string;
  isDefault: boolean;
  brand: BrandData;
}

export interface PersonOption {
  id: string;
  label: string;
  person: PersonData;
}

export interface AssetOption extends ImageRef {
  id: string;
  kind: string;
}

export function origin(): string {
  return appOrigin().origin;
}

export async function kitOptions(tx: Tx, organisationId: string): Promise<KitOption[]> {
  await ensureDefaultKit(tx, organisationId);
  const kits = await tx.brandKit.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { logo: { select: { id: true, contentType: true, width: true, height: true } } },
  });
  const o = origin();
  return kits.map((k) => ({ id: k.id, name: k.name, isDefault: k.isDefault, brand: toBrandData(k, o) }));
}

export async function personOptions(tx: Tx, limit = 100): Promise<PersonOption[]> {
  const people = await tx.person.findMany({ where: { active: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: limit, include: PHOTO_SELECT });
  const o = origin();
  return people.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}`.trim(), person: toPersonData(p, o) }));
}

export async function assetOptions(tx: Tx): Promise<AssetOption[]> {
  const rows = await tx.asset.findMany({
    where: { kind: { in: ["IMAGE", "BANNER"] } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, kind: true, contentType: true, width: true, height: true },
  });
  const o = origin();
  return rows.map((r) => ({ id: r.id, kind: r.kind, ...imageRef(o, r)! }));
}

export async function studioData(organisationId: string) {
  return asTenant(organisationId, async (tx) => ({
    kits: await kitOptions(tx, organisationId),
    people: await personOptions(tx),
    assets: await assetOptions(tx),
  }));
}

/** An image for a signature body or banner, uploaded from the studio. */
export async function uploadSignatureImage(
  ctx: { db?: PrismaClient; organisationId: string; actor: Actor; ipAddress?: string | null },
  file: Buffer,
  kind: "IMAGE" | "BANNER",
): Promise<AssetOption> {
  assertCan(ctx.actor, "manageTemplates");
  if (!file.length) throw new DomainError("invalid", "Choose an image.", "file");
  const img = await processImage(file, kind);
  const asset = await asTenant(
    ctx.organisationId,
    async (tx) => {
      const a = await saveAsset(tx, ctx.organisationId, kind, img);
      await audit(tx, ctx.organisationId, { userId: ctx.actor.userId, name: ctx.actor.name }, "asset.uploaded", { type: "Asset", id: a.id }, { kind }, ctx.ipAddress);
      return a;
    },
    ctx.db,
  );
  return { id: asset.id, kind, ...imageRef(origin(), asset)! };
}

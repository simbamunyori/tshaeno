import { createHash, randomBytes } from "node:crypto";
import type { AssetKind } from "@prisma/client";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import { asSystem, type Tx } from "@/server/db";
import { DomainError } from "@/server/org/access";
import type { ImageRef } from "@/lib/signature/types";

/**
 * Uploaded images: logos, photos and banners. Each one is decoded and
 * re-encoded, which strips anything hidden in the file and its metadata,
 * and scaled to a sensible size for email.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const LIMITS: Record<AssetKind, { width: number; height: number; square?: boolean }> = {
  LOGO: { width: 600, height: 300 },
  PHOTO: { width: 320, height: 320, square: true },
  BANNER: { width: 1200, height: 600 },
  IMAGE: { width: 1200, height: 1200 },
};

export interface ProcessedImage {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
}

export async function processImage(input: Buffer, kind: AssetKind): Promise<ProcessedImage> {
  if (input.length > MAX_UPLOAD_BYTES) throw new DomainError("invalid", "Choose an image under 5 MB.", "file");
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new DomainError("invalid", "That file isn't an image we can read. Use PNG, JPEG or GIF.", "file");
  }
  if (!meta.format || !["png", "jpeg", "gif", "webp"].includes(meta.format)) {
    throw new DomainError("invalid", "Use a PNG, JPEG or GIF image. Mail clients don't show SVG.", "file");
  }
  const limit = LIMITS[kind];
  const animated = meta.format === "gif" && (meta.pages ?? 1) > 1;
  let img = sharp(input, { animated }).rotate();
  img = limit.square
    ? img.resize(limit.width, limit.height, { fit: "cover", position: "attention" })
    : img.resize(limit.width, limit.height, { fit: "inside", withoutEnlargement: true });

  let out: { data: Buffer; info: OutputInfo };
  let contentType: string;
  if (animated) {
    out = await img.gif().toBuffer({ resolveWithObject: true });
    contentType = "image/gif";
  } else if (meta.hasAlpha) {
    out = await img.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer({ resolveWithObject: true });
    contentType = "image/png";
  } else {
    out = await img.flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    contentType = "image/jpeg";
  }
  const height = animated && out.info.pageHeight ? out.info.pageHeight : out.info.height;
  return { bytes: out.data, contentType, width: out.info.width, height };
}

/** A random id: asset links are public, so they must not be guessable. */
export function newAssetId(): string {
  return randomBytes(18).toString("base64url");
}

export async function saveAsset(tx: Tx, organisationId: string, kind: AssetKind, img: ProcessedImage) {
  return tx.asset.create({
    data: {
      id: newAssetId(),
      organisationId,
      kind,
      contentType: img.contentType,
      width: img.width,
      height: img.height,
      size: img.bytes.length,
      sha256: createHash("sha256").update(img.bytes).digest("hex"),
      bytes: new Uint8Array(img.bytes),
    },
    select: { id: true, width: true, height: true, contentType: true },
  });
}

export function assetUrl(origin: string, asset: { id: string; contentType: string }): string {
  const ext = asset.contentType === "image/png" ? "png" : asset.contentType === "image/gif" ? "gif" : "jpg";
  return `${origin}/i/a/${asset.id}.${ext}`;
}

export function imageRef(origin: string, asset: { id: string; contentType: string; width: number; height: number } | null | undefined): ImageRef | null {
  return asset ? { url: assetUrl(origin, asset), width: asset.width, height: asset.height } : null;
}

/** For the public image route: any organisation's asset, by its random id. */
export async function readPublicAsset(id: string) {
  if (!/^[A-Za-z0-9_-]{24}$/.test(id)) return null;
  return asSystem((tx) => tx.asset.findUnique({ where: { id }, select: { bytes: true, contentType: true, sha256: true } }));
}

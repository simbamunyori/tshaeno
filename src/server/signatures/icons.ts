import sharp from "sharp";
import { siFacebook, siGithub, siInstagram, siThreads, siTiktok, siWhatsapp, siX, siYoutube } from "simple-icons";
import type { ContactKind, SocialNetwork } from "@/lib/signature/types";
import { contrast } from "@/lib/signature/style";

/**
 * Small PNG icons for signatures, in any brand colour. Mail clients don't
 * show SVG, so these are drawn as SVG and turned into PNG on request, then
 * cached for good by the browser and by us.
 */

const SIZE = 64;

// Outline icons from Lucide (ISC licence), on a 24 by 24 grid.
const CONTACT_PATHS: Record<ContactKind, string> = {
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mobile: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  email: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  website: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  address: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};

// Brand marks from Simple Icons (CC0). LinkedIn isn't in that set, so it is drawn here.
const LINKEDIN =
  "M5.6 3.6a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2ZM3.8 9.4h3.6V21H3.8ZM9.6 9.4H13v1.6c.5-.9 1.7-1.9 3.6-1.9 3.6 0 4.3 2.3 4.3 5.4V21h-3.6v-5.6c0-1.3 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21H9.6Z";

const SOCIAL_PATHS: Record<SocialNetwork, string> = {
  linkedin: LINKEDIN,
  x: siX.path,
  facebook: siFacebook.path,
  instagram: siInstagram.path,
  youtube: siYoutube.path,
  tiktok: siTiktok.path,
  github: siGithub.path,
  whatsapp: siWhatsapp.path,
  threads: siThreads.path,
};

export const CONTACT_KINDS = Object.keys(CONTACT_PATHS) as ContactKind[];
export const SOCIAL_NETWORKS = Object.keys(SOCIAL_PATHS) as SocialNetwork[];

export function contactSvg(kind: ContactKind, hex: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none" stroke="${hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CONTACT_PATHS[kind]}</svg>`;
}

/** The mark in white on a circle of the brand colour, or dark when the colour is pale. */
export function socialSvg(network: SocialNetwork, hex: string): string {
  const glyph = contrast(hex, "#ffffff") >= 2 ? "#ffffff" : "#1f2937";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="12" fill="${hex}"/>` +
    `<g transform="translate(5.6 5.6) scale(0.533)"><path fill="${glyph}" d="${SOCIAL_PATHS[network]}"/></g></svg>`
  );
}

const cache = new Map<string, Buffer>();

async function png(key: string, svg: string): Promise<Buffer> {
  const hit = cache.get(key);
  if (hit) return hit;
  const out = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

/** Parses "0b7f78.png" into "#0b7f78". */
export function hexFromFile(file: string): string | null {
  const m = /^([0-9a-f]{6})\.png$/i.exec(file);
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function contactIcon(kind: string, hex: string): Promise<Buffer> | null {
  if (!(kind in CONTACT_PATHS)) return null;
  return png(`c:${kind}:${hex}`, contactSvg(kind as ContactKind, hex));
}

export function socialIcon(network: string, hex: string): Promise<Buffer> | null {
  if (!(network in SOCIAL_PATHS)) return null;
  return png(`s:${network}:${hex}`, socialSvg(network as SocialNetwork, hex));
}

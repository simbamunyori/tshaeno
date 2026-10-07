import type { Block, BrandColours, SignatureDoc, TemplateContent } from "./types";

/**
 * Checks that published signatures stay on brand: only the brand's
 * colours, the logo where there is one, the disclaimer where one is
 * required, and directory details complete enough to fill them in.
 * Pure and quick, so it runs on every visit to the reports.
 */

export interface BrandFinding {
  severity: "warning" | "note";
  template: string | null;
  message: string;
}

export interface BrandCheckTemplate {
  name: string;
  content: TemplateContent;
  brand: { colours: BrandColours; hasLogo: boolean; hasDisclaimer: boolean };
}

export interface DirectoryGaps {
  people: number;
  noTitle: number;
  noPhone: number;
}

const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi;

function normalise(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

/** Near-black, near-white and greys are allowed everywhere; they don't read as a brand colour. */
function neutral(hex: string): boolean {
  const n = normalise(hex);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) <= 12;
}

function walk(blocks: Block[], out: Block[] = []): Block[] {
  for (const b of blocks) {
    out.push(b);
    if (b.type === "columns") walk([...b.left, ...b.right], out);
  }
  return out;
}

function docColours(doc: SignatureDoc): string[] {
  const found: string[] = [];
  for (const b of walk(doc.blocks)) {
    for (const v of Object.values(b)) if (typeof v === "string" && /^#[0-9a-f]{3,6}$/i.test(v)) found.push(v);
  }
  return found;
}

const list = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function checkBrand(templates: BrandCheckTemplate[], gaps: DirectoryGaps): BrandFinding[] {
  const findings: BrandFinding[] = [];
  for (const t of templates) {
    const palette = new Set(Object.values(t.brand.colours).map(normalise));
    const used = t.content.kind === "VISUAL" ? docColours(t.content.doc) : (t.content.html.match(HEX) ?? []);
    const off = [...new Set(used.map(normalise))].filter((c) => !palette.has(c) && !neutral(c));
    if (off.length) {
      findings.push({
        severity: "warning",
        template: t.name,
        message: `Uses ${list(off.slice(0, 3))}${off.length > 3 ? ` and ${off.length - 3} more` : ""}, which ${off.length === 1 ? "isn't one of your brand colours" : "aren't among your brand colours"}.`,
      });
    }
    if (t.content.kind === "VISUAL") {
      const blocks = walk(t.content.doc.blocks);
      if (t.brand.hasLogo && !blocks.some((b) => b.type === "image" && b.source === "logo")) {
        findings.push({ severity: "note", template: t.name, message: "Doesn't show your logo." });
      }
      if (t.brand.hasDisclaimer && !blocks.some((b) => b.type === "disclaimer")) {
        findings.push({ severity: "warning", template: t.name, message: "Leaves out your disclaimer." });
      }
    }
  }
  const share = (n: number) => gaps.people > 0 && n / gaps.people >= 0.1;
  if (gaps.noTitle > 0 && share(gaps.noTitle)) {
    findings.push({ severity: "note", template: null, message: `${gaps.noTitle} of ${gaps.people} people have no job title, so their signatures leave it out.` });
  }
  if (gaps.noPhone > 0 && share(gaps.noPhone)) {
    findings.push({ severity: "note", template: null, message: `${gaps.noPhone} of ${gaps.people} people have no phone number.` });
  }
  return findings;
}

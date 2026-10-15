import { renderSignature } from "@/lib/signature/render";
import type { Block, ImageRef, SignatureDoc } from "@/lib/signature/types";
import { type Palette, type SampleInput, sampleBrand, sampleCompany, sampleGraphic, samplePerson } from "./samples";

/** The asset id the website uses for a graphic that only exists in the browser. */
export const PREVIEW_GRAPHIC = "preview-graphic";

/** Points every empty graphic slot at one image, so a preview can show it. */
export function withGraphic(doc: SignatureDoc): SignatureDoc {
  const fill = (b: Block): Block =>
    b.type === "banner" && !b.assetId
      ? { ...b, assetId: PREVIEW_GRAPHIC }
      : b.type === "columns"
        ? { ...b, left: b.left.map(fill) as typeof b.left, right: b.right.map(fill) as typeof b.right }
        : b;
  return { ...doc, blocks: doc.blocks.map(fill) };
}

export interface PreviewInput extends SampleInput {
  /** The graphic to show in the template's graphic slot. "sample" uses the made-up company's. */
  graphic?: ImageRef | "sample" | null;
}

/** A template filled in with a made-up company, or with what a visitor typed and uploaded. */
export function previewHtml(doc: SignatureDoc, p: Palette, origin: string, input: PreviewInput = {}): string {
  const brand = sampleBrand(p, input);
  const g = input.graphic === "sample" ? sampleGraphic(sampleCompany(input.industry), brand.colours.primary, p.secondary) : input.graphic;
  return renderSignature(g ? withGraphic(doc) : doc, { brand, person: samplePerson(p, input), assets: g ? { [PREVIEW_GRAPHIC]: g } : {}, origin }).html;
}

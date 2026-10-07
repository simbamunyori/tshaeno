import { z } from "zod";
import type { Block, BlockType, ColumnsBlock, LeafBlock, SignatureDoc } from "./types";

/**
 * Validating, creating and rearranging documents. The studio sends the
 * whole document on save, so the server checks every part of it here.
 */

const colourRef = z.union([z.enum(["primary", "secondary", "text", "muted"]), z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)]) as z.ZodType<
  "primary" | "secondary" | "text" | "muted" | `#${string}`
>;
const align = z.enum(["left", "center", "right"]);
const size = z.enum(["xs", "sm", "md", "lg", "xl"]);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);
const short = (max: number) => z.string().max(max);

const leaf = z.discriminatedUnion("type", [
  z.object({
    id,
    type: z.literal("text"),
    text: short(600),
    size,
    bold: z.boolean(),
    italic: z.boolean(),
    colour: colourRef,
    align,
    uppercase: z.boolean().optional(),
  }),
  z.object({
    id,
    type: z.literal("image"),
    source: z.enum(["logo", "photo", "asset"]),
    assetId: short(64).optional(),
    width: z.number().int().min(16).max(600),
    shape: z.enum(["square", "rounded", "circle"]),
    link: short(400),
    align,
  }),
  z.object({
    id,
    type: z.literal("contacts"),
    items: z.array(z.enum(["phone", "mobile", "email", "website", "address"])).max(5),
    layout: z.enum(["stacked", "inline"]),
    labels: z.enum(["icons", "letters", "none"]),
    size,
    colour: colourRef,
    accent: colourRef,
    align,
  }),
  z.object({ id, type: z.literal("socials"), size: z.union([z.literal(16), z.literal(20), z.literal(24), z.literal(28)]), colour: colourRef, align }),
  z.object({
    id,
    type: z.literal("divider"),
    colour: colourRef,
    thickness: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    width: z.number().min(10).max(100),
    align,
  }),
  z.object({ id, type: z.literal("spacer"), height: z.number().int().min(2).max(64) }),
  z.object({ id, type: z.literal("button"), label: short(60), url: short(400), colour: colourRef, textColour: colourRef, rounded: z.boolean(), align }),
  z.object({ id, type: z.literal("banner"), assetId: short(64).optional(), width: z.number().int().min(100).max(600), link: short(400), alt: short(120), align }),
  z.object({ id, type: z.literal("disclaimer"), size, colour: colourRef, align }),
]);

const columns = z.object({
  id,
  type: z.literal("columns"),
  left: z.array(leaf).max(20),
  right: z.array(leaf).max(20),
  leftWidth: z.number().int().min(40).max(400),
  gap: z.number().int().min(0).max(40),
  rule: z.boolean(),
  ruleColour: colourRef,
  valign: z.enum(["top", "middle"]),
});

export const docSchema = z.object({
  version: z.literal(1),
  width: z.number().int().min(280).max(640),
  baseSize: z.number().int().min(11).max(16),
  blocks: z.array(z.union([leaf, columns])).max(40),
});

export function parseDoc(input: unknown): SignatureDoc {
  return docSchema.parse(input) as SignatureDoc;
}

export function newId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `b${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10)}`;
}

export const BLOCK_LABEL: Record<BlockType, string> = {
  text: "Text",
  image: "Image",
  contacts: "Contact details",
  socials: "Social icons",
  divider: "Divider",
  spacer: "Space",
  button: "Button",
  banner: "Banner",
  disclaimer: "Disclaimer",
  columns: "Two columns",
};

export function newBlock(type: BlockType): Block {
  const base = { id: newId() };
  switch (type) {
    case "text":
      return { ...base, type, text: "{{name}}", size: "md", bold: false, italic: false, colour: "text", align: "left" };
    case "image":
      return { ...base, type, source: "logo", width: 120, shape: "square", link: "{{website}}", align: "left" };
    case "contacts":
      return { ...base, type, items: ["phone", "mobile", "email", "website"], layout: "stacked", labels: "letters", size: "sm", colour: "text", accent: "primary", align: "left" };
    case "socials":
      return { ...base, type, size: 20, colour: "primary", align: "left" };
    case "divider":
      return { ...base, type, colour: "secondary", thickness: 1, width: 100, align: "left" };
    case "spacer":
      return { ...base, type, height: 12 };
    case "button":
      return { ...base, type, label: "Book a meeting", url: "{{website}}", colour: "primary", textColour: "#ffffff", rounded: true, align: "left" };
    case "banner":
      return { ...base, type, width: 400, link: "{{website}}", alt: "", align: "left" };
    case "disclaimer":
      return { ...base, type, size: "xs", colour: "muted", align: "left" };
    case "columns":
      return {
        ...base,
        type,
        left: [{ id: newId(), type: "image", source: "photo", width: 80, shape: "circle", link: "", align: "left" }],
        right: [{ id: newId(), type: "text", text: "{{name}}", size: "lg", bold: true, italic: false, colour: "text", align: "left" }],
        leftWidth: 96,
        gap: 14,
        rule: false,
        ruleColour: "secondary",
        valign: "top",
      };
  }
}

export function emptyDoc(): SignatureDoc {
  return {
    version: 1,
    width: 480,
    baseSize: 13,
    blocks: [
      { id: newId(), type: "text", text: "{{name}}", size: "lg", bold: true, italic: false, colour: "text", align: "left" },
      { id: newId(), type: "text", text: "{{title}}", size: "sm", bold: false, italic: false, colour: "muted", align: "left" },
      newBlock("contacts"),
    ],
  };
}

/** Gives every block in a copied document a fresh id. */
export function reId(doc: SignatureDoc): SignatureDoc {
  const fresh = <T extends Block>(b: T): T =>
    b.type === "columns" ? ({ ...b, id: newId(), left: b.left.map(fresh), right: b.right.map(fresh) } as T) : ({ ...b, id: newId() } as T);
  return { ...doc, blocks: doc.blocks.map(fresh) };
}

// ─── Tree helpers for the studio ───────────────────────────────────

/** Where a block lives: the top level, or one side of a columns block. */
export type Slot = { parent: null } | { parent: string; side: "left" | "right" };

export function slotKey(slot: Slot): string {
  return slot.parent ? `${slot.parent}:${slot.side}` : "root";
}

export function parseSlotKey(key: string): Slot {
  if (key === "root") return { parent: null };
  const [parent, side] = key.split(":");
  return { parent, side: side === "right" ? "right" : "left" };
}

export function listIn(doc: SignatureDoc, slot: Slot): Block[] {
  if (!slot.parent) return doc.blocks;
  const col = doc.blocks.find((b): b is ColumnsBlock => b.id === slot.parent && b.type === "columns");
  return col ? col[slot.side] : [];
}

function withList(doc: SignatureDoc, slot: Slot, fn: (list: Block[]) => Block[]): SignatureDoc {
  if (!slot.parent) return { ...doc, blocks: fn(doc.blocks) };
  return {
    ...doc,
    blocks: doc.blocks.map((b) => (b.id === slot.parent && b.type === "columns" ? { ...b, [slot.side]: fn(b[slot.side]) as LeafBlock[] } : b)),
  };
}

export function findBlock(doc: SignatureDoc, blockId: string): { block: Block; slot: Slot; index: number } | null {
  const top = doc.blocks.findIndex((b) => b.id === blockId);
  if (top >= 0) return { block: doc.blocks[top], slot: { parent: null }, index: top };
  for (const b of doc.blocks) {
    if (b.type !== "columns") continue;
    for (const side of ["left", "right"] as const) {
      const i = b[side].findIndex((x) => x.id === blockId);
      if (i >= 0) return { block: b[side][i], slot: { parent: b.id, side }, index: i };
    }
  }
  return null;
}

export function updateBlock(doc: SignatureDoc, blockId: string, patch: Partial<Block>): SignatureDoc {
  const found = findBlock(doc, blockId);
  if (!found) return doc;
  return withList(doc, found.slot, (list) => list.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)));
}

export function removeBlock(doc: SignatureDoc, blockId: string): SignatureDoc {
  const found = findBlock(doc, blockId);
  if (!found) return doc;
  return withList(doc, found.slot, (list) => list.filter((b) => b.id !== blockId));
}

export function insertBlock(doc: SignatureDoc, block: Block, slot: Slot, index: number): SignatureDoc {
  // Columns can't sit inside columns.
  if (slot.parent && block.type === "columns") return doc;
  return withList(doc, slot, (list) => {
    const next = [...list];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    return next;
  });
}

/** Moves a block; index is where it ends up in the target list. */
export function moveBlock(doc: SignatureDoc, blockId: string, to: Slot, index: number): SignatureDoc {
  const found = findBlock(doc, blockId);
  if (!found) return doc;
  if (to.parent && (found.block.type === "columns" || to.parent === blockId)) return doc;
  // index is the block's final position in the target list.
  return insertBlock(removeBlock(doc, blockId), found.block, to, index);
}

export function duplicateBlock(doc: SignatureDoc, blockId: string): { doc: SignatureDoc; id: string } {
  const found = findBlock(doc, blockId);
  if (!found) return { doc, id: blockId };
  const copy = reId({ version: 1, width: 0, baseSize: 0, blocks: [found.block] }).blocks[0];
  return { doc: insertBlock(doc, copy, found.slot, found.index + 1), id: copy.id };
}

import { describe, expect, it } from "vitest";
import { emptyDoc, findBlock, insertBlock, listIn, moveBlock, newBlock, parseDoc, removeBlock, reId, updateBlock } from "./doc";
import { fillLines } from "./fields";
import { darkModeColour, contrast, DARK_BACKGROUND, safeHref } from "./style";
import type { ColumnsBlock, SignatureDoc } from "./types";

function sample(): SignatureDoc {
  const d = emptyDoc();
  d.blocks.push(newBlock("columns"));
  return d;
}

describe("documents", () => {
  it("validates what the studio sends", () => {
    expect(() => parseDoc(sample())).not.toThrow();
    expect(() => parseDoc({ ...sample(), width: 5000 })).toThrow();
    expect(() => parseDoc({ ...sample(), blocks: [{ id: "x", type: "script" }] })).toThrow();
    const nested = sample();
    (nested.blocks[3] as ColumnsBlock).left.push(newBlock("columns") as never);
    expect(() => parseDoc(nested)).toThrow();
  });

  it("moves blocks within a list, between lists, and refuses columns in columns", () => {
    let d = sample();
    const [a, b, c, col] = d.blocks.map((x) => x.id);
    d = moveBlock(d, c, { parent: null }, 0);
    expect(d.blocks.map((x) => x.id)).toEqual([c, a, b, col]);
    d = moveBlock(d, a, { parent: null }, 2);
    expect(d.blocks.map((x) => x.id)).toEqual([c, b, a, col]);
    d = moveBlock(d, b, { parent: col, side: "right" }, 0);
    expect(listIn(d, { parent: col, side: "right" })[0].id).toBe(b);
    expect(findBlock(d, b)?.slot).toEqual({ parent: col, side: "right" });
    expect(moveBlock(d, col, { parent: col, side: "left" }, 0)).toBe(d);
    expect(insertBlock(d, newBlock("columns"), { parent: col, side: "left" }, 0)).toBe(d);
  });

  it("updates, removes and re-ids", () => {
    let d = sample();
    const id = d.blocks[0].id;
    d = updateBlock(d, id, { text: "{{title}}" } as never);
    expect((d.blocks[0] as { text: string }).text).toBe("{{title}}");
    const copy = reId(d);
    expect(copy.blocks[0].id).not.toBe(id);
    d = removeBlock(d, id);
    expect(findBlock(d, id)).toBeNull();
  });
});

describe("fields", () => {
  const values = { name: "Lesedi Molefe", phone: "", mobile: "+267 71 234 567" };
  it("drops lines whose fields are all empty", () => {
    expect(fillLines("{{name}}\nT: {{phone}}\nM: {{mobile}}\nPlain line", values)).toEqual(["Lesedi Molefe", "M: +267 71 234 567", "Plain line"]);
  });
});

describe("colours and links", () => {
  it("lightens dark text for dark mode and leaves light text alone", () => {
    for (const c of ["#0b1f3a", "#000000", "#0b7f78", "#5a6472"]) expect(contrast(darkModeColour(c), DARK_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
    expect(darkModeColour("#e8e8e8")).toBe("#e8e8e8");
  });

  it("only makes safe links", () => {
    expect(safeHref("example.com")).toBe("https://example.com");
    expect(safeHref("https://example.com/a?b=c")).toBe("https://example.com/a?b=c");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("not a link")).toBeNull();
  });
});

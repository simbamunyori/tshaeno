import { describe, expect, it } from "vitest";
import { checkBrand } from "./brand-check";
import type { SignatureDoc } from "./types";

const colours = { primary: "#16335C", secondary: "#1F9E8F", text: "#222222", muted: "#6B7280" };
const brand = { colours, hasLogo: true, hasDisclaimer: true };
const doc = (blocks: SignatureDoc["blocks"]): SignatureDoc => ({ version: 1, width: 480, baseSize: 13, blocks });
const noGaps = { people: 10, noTitle: 0, noPhone: 0 };

describe("brand check", () => {
  it("passes a signature that uses brand colours, the logo and the disclaimer", () => {
    const d = doc([
      { id: "a", type: "image", source: "logo", width: 120, shape: "square", link: "", align: "left" },
      { id: "b", type: "text", text: "{{name}}", size: "md", bold: true, italic: false, colour: "#16335c", align: "left" },
      { id: "c", type: "disclaimer", size: "xs", colour: "muted", align: "left" },
    ]);
    expect(checkBrand([{ name: "Main", content: { kind: "VISUAL", doc: d }, brand }], noGaps)).toEqual([]);
  });

  it("flags colours outside the brand, but not greys", () => {
    const d = doc([
      {
        id: "x",
        type: "columns",
        leftWidth: 100,
        gap: 12,
        rule: true,
        ruleColour: "#ff0000",
        valign: "top",
        left: [{ id: "a", type: "image", source: "logo", width: 120, shape: "square", link: "", align: "left" }],
        right: [
          { id: "b", type: "text", text: "Hi", size: "md", bold: false, italic: false, colour: "#00f", align: "left" },
          { id: "c", type: "divider", colour: "#e5e5e5", thickness: 1, width: 100, align: "left" },
          { id: "d", type: "disclaimer", size: "xs", colour: "muted", align: "left" },
        ],
      },
    ]);
    const [f] = checkBrand([{ name: "Sales", content: { kind: "VISUAL", doc: d }, brand }], noGaps);
    expect(f).toEqual({ severity: "warning", template: "Sales", message: "Uses #ff0000 and #0000ff, which aren't among your brand colours." });
  });

  it("notices a missing logo or disclaimer, and colours in HTML signatures", () => {
    const findings = checkBrand(
      [
        { name: "Plain", content: { kind: "VISUAL", doc: doc([]) }, brand },
        { name: "Coded", content: { kind: "HTML", html: '<p style="color:#C0FFEE">Hi</p>' }, brand },
      ],
      noGaps,
    );
    expect(findings.map((f) => `${f.template}: ${f.message}`)).toEqual([
      "Plain: Doesn't show your logo.",
      "Plain: Leaves out your disclaimer.",
      "Coded: Uses #c0ffee, which isn't one of your brand colours.",
    ]);
  });

  it("points out gaps in the directory once they matter", () => {
    expect(checkBrand([], { people: 20, noTitle: 1, noPhone: 0 })).toEqual([]);
    expect(checkBrand([], { people: 20, noTitle: 5, noPhone: 2 })).toEqual([
      { severity: "note", template: null, message: "5 of 20 people have no job title, so their signatures leave it out." },
      { severity: "note", template: null, message: "2 of 20 people have no phone number." },
    ]);
  });
});

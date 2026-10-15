import { describe, expect, it } from "vitest";
import { renderSignature } from "@/lib/signature/render";
import { STARTERS } from "@/lib/signature/starters";
import { PALETTES, initials, palette, safeColour, sampleBrand, sampleLogo, samplePerson } from "./samples";

describe("website samples", () => {
  it("makes initials", () => {
    expect(initials("Kgale Advisory")).toBe("KA");
    expect(initials("acme")).toBe("AC");
    expect(initials("  ")).toBe("T");
  });

  it("escapes the company name inside the logo", () => {
    const svg = decodeURIComponent(sampleLogo(`<b>"A&B"</b>`, "#000000").url);
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;&quot;A&amp;B&quot;");
  });

  it("only takes hex colours", () => {
    expect(safeColour("#123abc", "#000000")).toBe("#123abc");
    expect(safeColour("red;background:url(x)", "#000000")).toBe("#000000");
    expect(palette("nope")).toBe(PALETTES[0]);
  });

  it("renders every starter with a logo and the person's name", () => {
    const p = palette("navy");
    const brand = sampleBrand(p, { company: "Thuso Legal" });
    const person = samplePerson(p, { name: "Neo Kgosi", title: "Partner" });
    for (const s of STARTERS) {
      const { html } = renderSignature(s.doc, { brand, person, assets: {}, origin: "https://tshaeno.example" });
      expect(html, s.key).toContain("Neo Kgosi");
    }
  });
});

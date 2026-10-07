import { describe, expect, it } from "vitest";
import { checkSignatureHtml, GMAIL_SIGNATURE_LIMIT } from "./check";
import { parseDoc } from "./doc";
import { SAMPLE_PERSON } from "./fields";
import { renderSignature } from "./render";
import { STARTERS } from "./starters";
import type { BrandData, PersonData, RenderContext } from "./types";

const ORIGIN = "https://app.tshaeno.com";

const FULL_BRAND: BrandData = {
  colours: { primary: "#0B7F78", secondary: "#2EC4B6", text: "#0B1F3A", muted: "#5A6472" },
  font: "georgia",
  company: "Kalahari Freight",
  website: "kalaharifreight.co.bw",
  address: "Plot 50369, Fairgrounds, Gaborone",
  disclaimer: "This email is confidential.\nIt is meant only for the person named above.",
  socials: [
    { network: "linkedin", url: "https://www.linkedin.com/company/kalahari" },
    { network: "x", url: "x.com/kalahari" },
    { network: "instagram", url: "https://instagram.com/kalahari" },
  ],
  logo: { url: `${ORIGIN}/i/a/logo.png`, width: 600, height: 160 },
};

const BARE_BRAND: BrandData = { ...FULL_BRAND, company: "", website: "", address: "", disclaimer: "", socials: [], logo: null };

const FULL_PERSON: PersonData = { ...SAMPLE_PERSON, photo: { url: `${ORIGIN}/i/a/photo.jpg`, width: 320, height: 320 } };
const SPARSE_PERSON: PersonData = { ...SAMPLE_PERSON, title: "", department: "", phone: "", mobile: "", photo: null };

const ctx = (brand: BrandData, person: PersonData): RenderContext => ({ brand, person, assets: {}, origin: ORIGIN });

describe("starter library", () => {
  it("has at least 30 templates across industries, each valid", () => {
    expect(STARTERS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(STARTERS.map((s) => s.industry)).size).toBeGreaterThanOrEqual(15);
    expect(new Set(STARTERS.map((s) => s.key)).size).toBe(STARTERS.length);
    for (const s of STARTERS) expect(() => parseDoc(s.doc), s.key).not.toThrow();
  });

  const cases = STARTERS.flatMap((s) =>
    [
      ["full", FULL_BRAND, FULL_PERSON],
      ["bare", BARE_BRAND, SPARSE_PERSON],
    ].map(([label, brand, person]) => [`${s.key} (${label})`, s, brand, person] as const),
  );

  it.each(cases)("%s works in Outlook, Gmail and Apple Mail", (_label, s, brand, person) => {
    const { html, text } = renderSignature(s.doc, ctx(brand as BrandData, person as PersonData));
    const result = checkSignatureHtml(html);
    expect(result.issues.filter((i) => i.severity !== "note")).toEqual([]);
    expect(result.clients).toEqual({ outlook: "pass", gmail: "pass", apple: "pass" });
    expect(html.length).toBeLessThan(GMAIL_SIGNATURE_LIMIT);
    expect(text).toContain("Lesedi Molefe");
  });
});

describe("renderSignature", () => {
  const doc = STARTERS.find((s) => s.key === "legal-partner")!.doc;

  it("uses only tables and inline styles", () => {
    const { html } = renderSignature(doc, ctx(FULL_BRAND, FULL_PERSON));
    expect(html).not.toMatch(/<style|<div|<p[\s>]|class=|display:\s*flex|position:/i);
    expect(html.startsWith("<table")).toBe(true);
    for (const img of html.match(/<img[^>]+>/g) ?? []) {
      expect(img).toMatch(/ width="\d+"/);
      expect(img).toMatch(/ height="\d+"/);
      expect(img).toMatch(/ alt="[^"]*"/);
      expect(img).toMatch(/src="https:\/\//);
    }
  });

  it("leaves out details a person doesn't have", () => {
    const { html, text } = renderSignature(doc, ctx(FULL_BRAND, SPARSE_PERSON));
    expect(text).not.toMatch(/^M:/m);
    expect(text).not.toMatch(/^T:/m);
    expect(html).not.toContain("tel:");
    expect(text).toContain("E: lesedi@example.com");
  });

  it("scales images to their real shape", () => {
    const { html } = renderSignature(doc, ctx(FULL_BRAND, FULL_PERSON));
    // 600 x 160 logo at 100 wide is 27 high.
    expect(html).toMatch(/logo\.png" width="100" height="27"/);
  });

  it("escapes people's details and refuses unsafe links", () => {
    const evil: PersonData = {
      ...FULL_PERSON,
      firstName: '<script>alert("x")</script>',
      title: '"><img src=x onerror=alert(1)>',
      custom: { linkedin: "javascript:alert(1)" },
    };
    const { html } = renderSignature(STARTERS[0].doc, ctx(FULL_BRAND, evil));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("&lt;script&gt;");
  });

  it("lets a person's own social link replace the company's", () => {
    const { html } = renderSignature(STARTERS[0].doc, ctx(FULL_BRAND, { ...FULL_PERSON, custom: { linkedin: "linkedin.com/in/lesedi" } }));
    expect(html).toContain('href="https://linkedin.com/in/lesedi"');
    expect(html).not.toContain("linkedin.com/company/kalahari");
  });

  it("follows the brand kit's colours and font", () => {
    const { html } = renderSignature(doc, ctx({ ...FULL_BRAND, colours: { ...FULL_BRAND.colours, primary: "#AA0000" } }, FULL_PERSON));
    expect(html).toContain("#aa0000");
    expect(html).toContain("Georgia, 'Times New Roman', serif");
    expect(html).toContain("/i/icon/phone/aa0000.png");
  });

  it("renders nothing for an empty document", () => {
    const { html, text } = renderSignature({ version: 1, width: 480, baseSize: 13, blocks: [] }, ctx(FULL_BRAND, FULL_PERSON));
    expect(html).toMatch(/^<table[^>]*><\/table>$/);
    expect(text).toBe("");
  });
});

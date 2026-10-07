import type { Block, LeafBlock, SignatureDoc } from "./types";

/**
 * The starter library: professional templates by industry. Each one uses
 * brand colours by role (primary, text, muted), so it takes on the
 * organisation's brand kit the moment it is opened.
 */

export interface Starter {
  key: string;
  name: string;
  industry: Industry;
  description: string;
  doc: SignatureDoc;
}

export const INDUSTRIES = [
  "General",
  "Legal",
  "Finance",
  "Healthcare",
  "Real estate",
  "Technology",
  "Education",
  "Hospitality",
  "Construction",
  "Consulting",
  "Retail",
  "Non-profit",
  "Public sector",
  "Logistics",
  "Creative",
  "Mining and energy",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

interface Copy {
  /** A short line under the title, such as a registration or slogan. */
  tagline?: string;
  /** A call to action button. */
  button?: string;
  /** Put the department after the title. */
  department?: boolean;
}

let seq = 0;
const id = (p: string) => `${p}${(seq++).toString(36)}`;

const name = (size: "lg" | "xl" = "lg", colour: "text" | "primary" = "text"): LeafBlock => ({
  id: id("n"),
  type: "text",
  text: "{{name}}",
  size,
  bold: true,
  italic: false,
  colour,
  align: "left",
});
const title = (c: Copy, opts: { uppercase?: boolean; colour?: "muted" | "primary" } = {}): LeafBlock => ({
  id: id("t"),
  type: "text",
  text: c.department ? "{{title}}, {{department}}" : "{{title}}",
  size: opts.uppercase ? "xs" : "sm",
  bold: !!opts.uppercase,
  italic: false,
  colour: opts.colour ?? "muted",
  align: "left",
  uppercase: opts.uppercase,
});
const company = (): LeafBlock => ({ id: id("c"), type: "text", text: "{{company}}", size: "sm", bold: true, italic: false, colour: "primary", align: "left" });
const tagline = (text: string): LeafBlock => ({ id: id("g"), type: "text", text, size: "xs", bold: false, italic: true, colour: "muted", align: "left" });
const contacts = (labels: "icons" | "letters" | "none", layout: "stacked" | "inline" = "stacked", items: ("phone" | "mobile" | "email" | "website" | "address")[] = ["phone", "mobile", "email", "website"]): LeafBlock => ({
  id: id("k"),
  type: "contacts",
  items,
  layout,
  labels,
  size: "sm",
  colour: "text",
  accent: "primary",
  align: "left",
});
const socials = (size: 16 | 20 | 24 = 20): LeafBlock => ({ id: id("s"), type: "socials", size, colour: "primary", align: "left" });
const divider = (width = 100, thickness: 1 | 2 | 3 = 1, colour: "secondary" | "primary" = "secondary"): LeafBlock => ({
  id: id("d"),
  type: "divider",
  colour,
  thickness,
  width,
  align: "left",
});
const space = (height = 8): LeafBlock => ({ id: id("p"), type: "spacer", height });
const logo = (width = 120): LeafBlock => ({ id: id("l"), type: "image", source: "logo", width, shape: "square", link: "{{website}}", align: "left" });
const photo = (width = 84, shape: "circle" | "rounded" = "circle"): LeafBlock => ({ id: id("f"), type: "image", source: "photo", width, shape, link: "", align: "left" });
const button = (label: string): LeafBlock => ({ id: id("b"), type: "button", label, url: "{{website}}", colour: "primary", textColour: "#ffffff", rounded: true, align: "left" });
const disclaimer = (): LeafBlock => ({ id: id("x"), type: "disclaimer", size: "xs", colour: "muted", align: "left" });
const extras = (c: Copy): LeafBlock[] => [...(c.tagline ? [tagline(c.tagline)] : []), ...(c.button ? [space(4), button(c.button)] : [])];
const doc = (blocks: Block[], width = 520): SignatureDoc => ({ version: 1, width, baseSize: 13, blocks });

/** The layouts every starter is built from. */
const LAYOUTS = {
  classic: (c: Copy) =>
    doc([name(), title(c), space(4), divider(100), contacts("letters"), ...extras(c), space(6), logo(120), socials(), disclaimer()]),
  photoLeft: (c: Copy) =>
    doc([
      {
        id: id("cols"),
        type: "columns",
        left: [photo(84)],
        right: [name(), title(c), space(4), contacts("icons"), ...extras(c)],
        leftWidth: 96,
        gap: 14,
        rule: false,
        ruleColour: "secondary",
        valign: "top",
      },
      space(6),
      socials(),
      disclaimer(),
    ]),
  logoRule: (c: Copy) =>
    doc([
      {
        id: id("cols"),
        type: "columns",
        left: [logo(110)],
        right: [name(), title(c), space(4), contacts("letters"), ...extras(c)],
        leftWidth: 124,
        gap: 14,
        rule: true,
        ruleColour: "secondary",
        valign: "middle",
      },
      space(4),
      disclaimer(),
    ]),
  compact: (c: Copy) =>
    doc([name("lg", "primary"), title(c), contacts("letters", "inline", ["phone", "email", "website"]), ...extras(c), disclaimer()], 560),
  executive: (c: Copy) =>
    doc([name("xl"), title(c, { uppercase: true, colour: "primary" }), space(8), contacts("icons", "stacked", ["phone", "mobile", "email", "website", "address"]), ...extras(c), space(6), divider(100), logo(100), disclaimer()]),
  accentBar: (c: Copy) =>
    doc([name("lg"), title(c), divider(18, 3, "primary"), company(), contacts("none", "stacked", ["phone", "email", "website"]), ...extras(c), space(6), socials(16), disclaimer()]),
  photoRule: (c: Copy) =>
    doc([
      {
        id: id("cols"),
        type: "columns",
        left: [photo(76, "rounded")],
        right: [name(), title(c), company(), space(2), contacts("letters", "stacked", ["phone", "mobile", "email"]), ...extras(c)],
        leftWidth: 86,
        gap: 14,
        rule: true,
        ruleColour: "primary",
        valign: "top",
      },
      space(6),
      logo(100),
      disclaimer(),
    ]),
  stackedLogo: (c: Copy) =>
    doc([logo(140), space(8), name(), title(c), space(2), contacts("icons", "inline", ["phone", "email", "website"]), ...extras(c), space(4), socials(), disclaimer()], 560),
} as const;

type LayoutKey = keyof typeof LAYOUTS;

const LAYOUT_LABEL: Record<LayoutKey, string> = {
  classic: "Classic",
  photoLeft: "Photo and details",
  logoRule: "Logo with rule",
  compact: "Compact",
  executive: "Executive",
  accentBar: "Accent bar",
  photoRule: "Photo with rule",
  stackedLogo: "Logo on top",
};

const LAYOUT_SUMMARY: Record<LayoutKey, string> = {
  classic: "Name, title and contact details over a fine rule, logo below.",
  photoLeft: "A round photo beside the person's details with small icons.",
  logoRule: "Logo on the left, a fine vertical rule, details on the right.",
  compact: "Three short lines, for people who email all day.",
  executive: "A larger name and an uppercase title, every way to get in touch.",
  accentBar: "A short bar of brand colour under the name.",
  photoRule: "Photo, a rule in the brand colour, details and company name.",
  stackedLogo: "Logo first, then the person and one line of contacts.",
};

const PLAN: [Industry, string, LayoutKey, Copy][] = [
  ["General", "Everyday", "classic", {}],
  ["General", "Personal", "photoLeft", {}],
  ["Legal", "Counsel", "logoRule", { department: true }],
  ["Legal", "Partner", "executive", {}],
  ["Finance", "Advisory", "classic", { department: true, tagline: "Authorised financial services provider" }],
  ["Finance", "Client desk", "accentBar", { button: "Book a review" }],
  ["Healthcare", "Practice", "photoLeft", { button: "Book an appointment" }],
  ["Healthcare", "Clinic", "logoRule", { tagline: "In an emergency, call your local emergency number." }],
  ["Real estate", "Agent", "photoRule", { button: "View listings" }],
  ["Real estate", "Agency", "stackedLogo", { tagline: "Registered with the Real Estate Advisory Council" }],
  ["Technology", "Product", "compact", { button: "Book a demo" }],
  ["Technology", "Engineering", "photoLeft", { department: true }],
  ["Education", "Faculty", "classic", { department: true }],
  ["Education", "Admissions", "accentBar", { button: "Apply now" }],
  ["Hospitality", "Guest relations", "stackedLogo", { button: "Book your stay" }],
  ["Hospitality", "Events", "photoRule", { tagline: "Weddings, conferences and private dining" }],
  ["Construction", "Site", "executive", { tagline: "Safety first, every site, every day" }],
  ["Construction", "Projects", "logoRule", { department: true }],
  ["Consulting", "Advisor", "photoLeft", { button: "Book a call" }],
  ["Consulting", "Practice lead", "executive", { department: true }],
  ["Retail", "Store", "stackedLogo", { button: "Shop now" }],
  ["Retail", "Customer care", "compact", { tagline: "Here to help, Monday to Saturday" }],
  ["Non-profit", "Programme", "accentBar", { button: "Donate" }],
  ["Non-profit", "Volunteer", "photoLeft", { tagline: "Thank you for standing with us" }],
  ["Public sector", "Office", "classic", { department: true }],
  ["Public sector", "Service desk", "logoRule", { tagline: "Serving the public with integrity" }],
  ["Logistics", "Operations", "compact", { button: "Track a shipment", department: true }],
  ["Logistics", "Fleet", "logoRule", {}],
  ["Creative", "Studio", "photoRule", { button: "See our work" }],
  ["Creative", "Producer", "stackedLogo", {}],
  ["Mining and energy", "Site office", "executive", { tagline: "Zero harm" }],
  ["Mining and energy", "Corporate", "classic", { department: true }],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const STARTERS: Starter[] = PLAN.map(([industry, label, layout, copy]) => ({
  key: `${slug(industry)}-${slug(label)}`,
  name: `${label}`,
  industry,
  description: `${LAYOUT_LABEL[layout]}. ${LAYOUT_SUMMARY[layout]}${copy.button ? ` Includes a "${copy.button}" button.` : ""}`,
  doc: LAYOUTS[layout](copy),
}));

export function starter(key: string): Starter | undefined {
  return STARTERS.find((s) => s.key === key);
}

/** A starting point for full HTML mode: a plain, email-safe table. */
export const HTML_STARTER = `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:Arial, Helvetica, sans-serif">
  <tr>
    <td style="padding:0 0 4px 0;font-size:16px;line-height:22px;font-weight:bold;color:#0b1f3a">{{name}}</td>
  </tr>
  <tr>
    <td style="padding:0 0 8px 0;font-size:13px;line-height:18px;color:#5a6472">{{title}}, {{company}}</td>
  </tr>
  <tr>
    <td style="padding:0;font-size:13px;line-height:18px;color:#0b1f3a">
      <a href="tel:{{phone}}" style="color:#0b1f3a;text-decoration:none">{{phone}}</a><br>
      <a href="mailto:{{email}}" style="color:#0b7f78;text-decoration:none">{{email}}</a>
    </td>
  </tr>
</table>`;

import type { Block, ColumnsBlock, LeafBlock, SignatureDoc } from "./types";

/**
 * The starter library: templates by industry. Each one uses brand colours
 * by role (primary, secondary, text, muted), so it takes on the
 * organisation's brand kit the moment it is opened, and each has a
 * graphic slot that stays empty until the company uploads its own.
 */

export interface Starter {
  key: string;
  name: string;
  industry: Industry;
  description: string;
  /** Shown on the website with a sample graphic in its graphic slot. */
  graphic: boolean;
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

type Tone = "text" | "primary" | "muted" | `#${string}`;

const text = (t: string, size: "xs" | "sm" | "md" | "lg" | "xl", colour: Tone, opts: { bold?: boolean; italic?: boolean; uppercase?: boolean; serif?: boolean } = {}): LeafBlock => ({
  id: id("t"),
  type: "text",
  text: t,
  size,
  bold: !!opts.bold,
  italic: !!opts.italic,
  colour,
  align: "left",
  ...(opts.uppercase ? { uppercase: true } : {}),
  ...(opts.serif ? { serif: true } : {}),
});
const name = (size: "lg" | "xl" = "lg", opts: { colour?: Tone; serif?: boolean } = {}) =>
  text("{{name}}", size, opts.colour ?? "text", { bold: !opts.serif, serif: opts.serif });
const titleText = (c: Copy) => (c.department ? "{{title}}, {{department}}" : "{{title}}");
const title = (c: Copy, opts: { uppercase?: boolean; colour?: Tone } = {}) =>
  text(titleText(c), opts.uppercase ? "xs" : "sm", opts.colour ?? "muted", { bold: !!opts.uppercase, uppercase: opts.uppercase });
const company = (colour: Tone = "text") => text("{{company}}", "sm", colour, { bold: true });
const tagline = (t: string, colour: Tone = "muted") => text(t, "xs", colour, { italic: true });
const contacts = (
  labels: "icons" | "letters" | "none",
  layout: "stacked" | "inline" = "stacked",
  items: ("phone" | "mobile" | "email" | "website" | "address")[] = ["phone", "mobile", "email", "website"],
  colour: Tone = "text",
  accent: Tone = "primary",
): LeafBlock => ({ id: id("k"), type: "contacts", items, layout, labels, size: "sm", colour, accent, align: "left" });
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
const button = (label: string, outline = false): LeafBlock => ({
  id: id("b"),
  type: "button",
  label,
  url: "{{website}}",
  colour: "primary",
  textColour: "#ffffff",
  rounded: true,
  ...(outline ? { outline: true } : {}),
  align: "left",
});
/** A place for the company's own graphic. Empty until someone uploads one, and then it shows. */
const graphic = (width = 460): LeafBlock => ({ id: id("g"), type: "banner", width, link: "{{website}}", alt: "", align: "left" });
const disclaimer = (): LeafBlock => ({ id: id("x"), type: "disclaimer", size: "xs", colour: "muted", align: "left" });
const extras = (c: Copy, outline = false): LeafBlock[] => [...(c.tagline ? [tagline(c.tagline)] : []), ...(c.button ? [space(6), button(c.button, outline)] : [])];
const doc = (blocks: Block[], width = 520): SignatureDoc => ({ version: 1, width, baseSize: 13, blocks });
const cols = (left: LeafBlock[], right: LeafBlock[], o: Partial<Omit<ColumnsBlock, "id" | "type" | "left" | "right">> = {}): ColumnsBlock => ({
  id: id("cols"),
  type: "columns",
  left,
  right,
  leftWidth: 96,
  gap: 16,
  rule: false,
  ruleColour: "secondary",
  valign: "top",
  ...o,
});

/** A soft neutral that sits well under any brand colour. */
const PANEL = "#f5f3ee";
/** Light text for a panel of brand colour. */
const ON_BRAND = "#ffffff";
const ON_BRAND_SOFT = "#e7e4dc";

/** The layouts every starter is built from. */
const LAYOUTS = {
  agent: (c: Copy) =>
    doc([
      cols([photo(88, "rounded")], [name("lg"), title(c, { uppercase: true, colour: "primary" }), company(), space(4), contacts("icons", "stacked", ["phone", "mobile", "email", "website"]), ...extras(c)], {
        leftWidth: 100,
        rule: true,
        ruleColour: "primary",
        ruleWidth: 2,
      }),
      space(8),
      logo(150),
      graphic(),
      disclaimer(),
    ]),
  editorial: (c: Copy) =>
    doc([
      name("xl", { serif: true }),
      title(c, { uppercase: true, colour: "primary" }),
      space(6),
      divider(12, 2, "primary"),
      contacts("none", "inline", ["phone", "email", "website"], "text"),
      ...extras(c, true),
      space(10),
      cols([logo(170)], [socials(16)], { leftWidth: 300, gap: 12, valign: "middle" }),
      graphic(),
      disclaimer(),
    ]),
  panel: (c: Copy) =>
    doc([
      cols([photo(76)], [name("lg"), title(c), space(4), contacts("icons", "stacked", ["phone", "email", "website"]), ...extras(c)], { leftWidth: 92, background: PANEL, padding: 18, valign: "middle" }),
      space(6),
      cols([logo(150)], [socials(20)], { leftWidth: 300, gap: 12, valign: "middle" }),
      graphic(),
      disclaimer(),
    ]),
  band: (c: Copy) =>
    doc([
      cols(
        [photo(64)],
        [
          text("{{name}}", "lg", ON_BRAND, { bold: true }),
          text(titleText(c), "xs", ON_BRAND_SOFT, { bold: true, uppercase: true }),
          ...(c.tagline ? [tagline(c.tagline, ON_BRAND_SOFT)] : []),
        ],
        { leftWidth: 78, background: "primary", padding: 16, valign: "middle" },
      ),
      space(6),
      contacts("letters", "inline", ["phone", "mobile", "email"]),
      contacts("letters", "inline", ["website", "address"]),
      ...(c.button ? [space(4), button(c.button)] : []),
      space(6),
      logo(150),
      graphic(),
      disclaimer(),
    ]),
  logoRule: (c: Copy) =>
    doc([
      cols([logo(140)], [name("lg"), title(c), space(4), contacts("letters"), ...extras(c), space(2), socials(16)], {
        leftWidth: 158,
        gap: 18,
        rule: true,
        ruleColour: "secondary",
        valign: "middle",
      }),
      space(4),
      graphic(),
      disclaimer(),
    ]),
  executive: (c: Copy) =>
    doc([
      name("xl", { serif: true }),
      title(c, { uppercase: true, colour: "primary" }),
      space(8),
      contacts("icons", "stacked", ["phone", "mobile", "email", "website", "address"]),
      ...extras(c),
      space(6),
      divider(100),
      cols([logo(150)], [socials(20)], { leftWidth: 300, gap: 12, valign: "middle" }),
      graphic(),
      disclaimer(),
    ]),
  campaign: (c: Copy) =>
    doc(
      [
        name("lg"),
        text(c.department ? "{{title}}, {{department}} · {{company}}" : "{{title}} · {{company}}", "sm", "muted"),
        space(2),
        contacts("icons", "inline", ["phone", "email", "website"]),
        ...(c.tagline ? [tagline(c.tagline)] : []),
        space(8),
        graphic(480),
        ...(c.button ? [button(c.button)] : []),
        space(4),
        socials(20),
        disclaimer(),
      ],
      540,
    ),
  compact: (c: Copy) =>
    doc(
      [
        text(c.department ? "{{name}}  |  {{title}}, {{department}}" : "{{name}}  |  {{title}}", "sm", "text", { bold: true }),
        contacts("letters", "inline", ["phone", "email", "website"], "text", "primary"),
        ...extras(c, true),
        space(4),
        logo(120),
        graphic(),
        disclaimer(),
      ],
      560,
    ),
  stackedLogo: (c: Copy) =>
    doc(
      [
        logo(200),
        space(10),
        divider(100),
        name("lg", { serif: true }),
        title(c),
        space(2),
        contacts("icons", "inline", ["phone", "email", "website"]),
        ...extras(c),
        space(6),
        graphic(480),
        socials(20),
        disclaimer(),
      ],
      560,
    ),
  founder: (c: Copy) =>
    doc([
      cols([photo(96)], [name("xl", { serif: true }), title(c, { uppercase: true, colour: "primary" }), space(6), contacts("icons", "stacked", ["phone", "email", "website"]), ...extras(c), space(2), socials(16)], {
        leftWidth: 112,
        gap: 18,
        valign: "middle",
      }),
      space(8),
      divider(100),
      logo(150),
      graphic(),
      disclaimer(),
    ]),
} as const;

type LayoutKey = keyof typeof LAYOUTS;

const LAYOUT_SUMMARY: Record<LayoutKey, string> = {
  agent: "Your photo, a line in your brand colour, then everything a client needs to reach you.",
  editorial: "A serif name, a short brand-coloured rule and contact details on one line. Quiet and confident.",
  panel: "Photo and details on a soft card, with your logo and social links underneath.",
  band: "A band of your brand colour with the photo and name, contact details beneath it.",
  logoRule: "Logo on the left, a fine rule, and the person's details on the right.",
  executive: "A large serif name over every way to get in touch, finished with the logo.",
  campaign: "Short details up top, so your graphic and button get the attention.",
  compact: "Two lines and a small logo, for replies and people who email all day.",
  stackedLogo: "The logo leads, with the person underneath and room for a graphic.",
  founder: "A big photo beside a serif name. Personal, for people clients ask for by name.",
};

/** Layouts built around a graphic, shown with a sample one on the website. */
const FEATURES_GRAPHIC: LayoutKey[] = ["campaign", "stackedLogo", "agent"];

const PLAN: [Industry, string, LayoutKey, Copy][] = [
  ["General", "Everyday", "editorial", {}],
  ["General", "Personal", "founder", {}],
  ["Legal", "Counsel", "logoRule", { department: true }],
  ["Legal", "Partner", "executive", {}],
  ["Finance", "Advisory", "editorial", { department: true, tagline: "Authorised financial services provider" }],
  ["Finance", "Client desk", "panel", { button: "Book a review" }],
  ["Healthcare", "Practice", "agent", { button: "Book an appointment" }],
  ["Healthcare", "Clinic", "band", { tagline: "In an emergency, call 997 or go to your nearest hospital." }],
  ["Real estate", "Agent", "agent", { button: "View listings" }],
  ["Real estate", "Agency", "stackedLogo", { tagline: "Registered with the Real Estate Advisory Council" }],
  ["Technology", "Product", "campaign", { button: "Book a demo" }],
  ["Technology", "Engineering", "compact", { department: true }],
  ["Education", "Faculty", "editorial", { department: true }],
  ["Education", "Admissions", "campaign", { button: "Apply now" }],
  ["Hospitality", "Guest relations", "campaign", { button: "Book your stay" }],
  ["Hospitality", "Events", "panel", { tagline: "Weddings, conferences and private dining" }],
  ["Construction", "Site", "band", { tagline: "Safety first, on every site, every day" }],
  ["Construction", "Projects", "logoRule", { department: true }],
  ["Consulting", "Advisor", "founder", { button: "Book a call" }],
  ["Consulting", "Practice lead", "executive", { department: true }],
  ["Retail", "Store", "campaign", { button: "Shop the collection" }],
  ["Retail", "Customer care", "compact", { tagline: "We're here Monday to Saturday, 8am to 6pm" }],
  ["Non-profit", "Programme", "campaign", { button: "Give today" }],
  ["Non-profit", "Volunteer", "panel", { tagline: "Thank you for standing with us" }],
  ["Public sector", "Office", "editorial", { department: true }],
  ["Public sector", "Service desk", "logoRule", { tagline: "Most services are now online, with no queue" }],
  ["Logistics", "Operations", "band", { button: "Track a shipment", department: true }],
  ["Logistics", "Fleet", "compact", {}],
  ["Creative", "Studio", "founder", { button: "See our work" }],
  ["Creative", "Producer", "stackedLogo", {}],
  ["Mining and energy", "Site office", "band", { tagline: "Zero harm" }],
  ["Mining and energy", "Corporate", "executive", { department: true }],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const STARTERS: Starter[] = PLAN.map(([industry, label, layout, copy]) => ({
  key: `${slug(industry)}-${slug(label)}`,
  name: `${label}`,
  industry,
  description: `${LAYOUT_SUMMARY[layout]}${copy.button ? ` Ends with a "${copy.button}" button.` : ""}`,
  graphic: FEATURES_GRAPHIC.includes(layout),
  doc: LAYOUTS[layout](copy),
}));

export function starter(key: string): Starter | undefined {
  return STARTERS.find((s) => s.key === key);
}

/** A starting point for full HTML mode: a plain, email-safe table. */
export const HTML_STARTER = `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:Arial, Helvetica, sans-serif">
  <tr>
    <td style="padding:0 0 4px 0;font-size:16px;line-height:22px;font-weight:bold;color:#11182b">{{name}}</td>
  </tr>
  <tr>
    <td style="padding:0 0 8px 0;font-size:13px;line-height:18px;color:#5a6472">{{title}}, {{company}}</td>
  </tr>
  <tr>
    <td style="padding:0;font-size:13px;line-height:18px;color:#0b1f3a">
      <a href="tel:{{phone}}" style="color:#0b1f3a;text-decoration:none">{{phone}}</a><br>
      <a href="mailto:{{email}}" style="color:#14213d;text-decoration:none">{{email}}</a>
    </td>
  </tr>
</table>`;

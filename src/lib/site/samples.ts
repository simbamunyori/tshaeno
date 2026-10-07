import type { BrandData, FontKey, ImageRef, PersonData } from "@/lib/signature/types";

/**
 * Made-up companies and people for the website's previews, so every
 * template is shown filled in, with a logo and a photo, before anyone
 * signs up. Images are inline SVG, so nothing is fetched or stored.
 */

export interface Palette {
  key: string;
  name: string;
  primary: string;
  secondary: string;
}

export const PALETTES: Palette[] = [
  { key: "teal", name: "Teal", primary: "#0B7F78", secondary: "#C9D3DE" },
  { key: "navy", name: "Navy", primary: "#0B1F3A", secondary: "#B9C4D3" },
  { key: "maroon", name: "Maroon", primary: "#7A1F3D", secondary: "#E2C9D1" },
  { key: "forest", name: "Forest", primary: "#1F5E3A", secondary: "#C8DCCF" },
  { key: "ochre", name: "Ochre", primary: "#A35F00", secondary: "#EAD9BF" },
];

export function palette(key: string | null | undefined): Palette {
  return PALETTES.find((p) => p.key === key) ?? PALETTES[0];
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A hex colour from a form, or the fallback when it isn't one. */
export function safeColour(v: string | null | undefined, fallback: string): string {
  return v && HEX.test(v) ? v : fallback;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function svgRef(svg: string, width: number, height: number): ImageRef {
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height };
}

export function initials(text: string, max = 2): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, max).map((w) => w[0]) : [...(words[0] ?? "")].slice(0, max);
  return letters.join("").toUpperCase() || "T";
}

/** A wordmark: a tile with the initials, then the name. */
export function sampleLogo(company: string, colour: string): ImageRef {
  const name = company.trim().slice(0, 28) || "Your company";
  const width = Math.max(140, 64 + Math.round(name.length * 10.5));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="48" viewBox="0 0 ${width} 48">` +
    `<rect width="40" height="40" x="0" y="4" rx="9" fill="${colour}"/>` +
    `<text x="20" y="30" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" fill="#fff">${xml(initials(name))}</text>` +
    `<text x="50" y="31" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" fill="${colour}">${xml(name)}</text>` +
    `</svg>`;
  return svgRef(svg, width, 48);
}

/** A round photo stand-in with the person's initials. */
export function sampleAvatar(name: string, colour: string): ImageRef {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
    `<rect width="160" height="160" fill="${colour}" opacity="0.16"/>` +
    `<text x="80" y="96" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="700" fill="${colour}">${xml(initials(name))}</text>` +
    `</svg>`;
  return svgRef(svg, 160, 160);
}

export interface SampleInput {
  company?: string;
  website?: string;
  name?: string;
  title?: string;
  primary?: string;
  font?: FontKey;
}

export const SAMPLE_COMPANY = "Kgale Advisory";

/** kgaleadvisory.example, from the company name. */
export function sampleDomain(company: string | undefined): string {
  const slug = (company ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  return `${slug || "kgaleadvisory"}.example`;
}

export function sampleBrand(p: Palette, input: SampleInput = {}): BrandData {
  const primary = safeColour(input.primary, p.primary);
  const company = input.company?.trim() || SAMPLE_COMPANY;
  return {
    colours: { primary, secondary: p.secondary, text: "#1F2933", muted: "#5A6472" },
    font: input.font ?? "arial",
    company,
    website: input.website?.trim() || sampleDomain(input.company),
    address: "Plot 113, Kgale Mews, Gaborone",
    disclaimer: `This email is confidential and meant only for the person it is addressed to. ${company} is a made-up company used to show Tshaeno templates.`,
    socials: [
      { network: "linkedin", url: "https://www.linkedin.com/company/example" },
      { network: "facebook", url: "https://www.facebook.com/example" },
    ],
    logo: sampleLogo(company, primary),
  };
}

export function samplePerson(p: Palette, input: SampleInput = {}): PersonData {
  const full = input.name?.trim() || "Lesedi Molefe";
  const [firstName, ...rest] = full.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
    email: `${firstName.toLowerCase().replace(/[^a-z]/g, "") || "lesedi"}@${sampleDomain(input.company)}`,
    title: input.title?.trim() || "Head of Operations",
    department: "Operations",
    location: "Gaborone",
    phone: "+267 390 1234",
    mobile: "+267 71 234 567",
    photo: sampleAvatar(full, safeColour(input.primary, p.primary)),
    custom: {},
  };
}

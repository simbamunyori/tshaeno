import type { BrandData, FontKey, ImageRef, PersonData } from "@/lib/signature/types";

/**
 * Made-up companies and people for the website's previews, so every
 * template is shown filled in, with a logo, a photo and a graphic,
 * before anyone signs up. Each industry has its own company, so a law
 * firm's template doesn't arrive wearing a mining company's logo.
 * Images are inline SVG, so nothing is fetched or stored.
 */

export interface Palette {
  key: string;
  name: string;
  primary: string;
  secondary: string;
}

export const PALETTES: Palette[] = [
  { key: "midnight", name: "Midnight", primary: "#14213D", secondary: "#D9CCB0" },
  { key: "cobalt", name: "Cobalt", primary: "#1D4690", secondary: "#C6D2E8" },
  { key: "oxblood", name: "Oxblood", primary: "#6B1E2E", secondary: "#E3CCC6" },
  { key: "forest", name: "Forest", primary: "#1E4A37", secondary: "#C8D8CC" },
  { key: "graphite", name: "Graphite", primary: "#2A2E35", secondary: "#D2D2D0" },
  { key: "bronze", name: "Bronze", primary: "#7E5F27", secondary: "#E6DAC0" },
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

// ─── The made-up companies ─────────────────────────────────────────

type Symbol = "arch" | "columns" | "cross" | "hexagon" | "book" | "sun" | "beams" | "compass" | "bag" | "hands" | "shield" | "arrow" | "peak" | "quarter" | "bars" | "ring";

export interface SampleCompany {
  /** The name as the logo shows it. */
  name: string;
  /** The name as it is written in a sentence. */
  full: string;
  /** The small line under the name in the logo, such as ATTORNEYS. */
  descriptor: string;
  domain: string;
  address: string;
  symbol: Symbol;
  /** Serif for firms that would use one, sans for the rest. */
  serif: boolean;
  /** What the sample graphic says. */
  graphic: [headline: string, line: string];
  person: { name: string; title: string; department: string };
}

const COMPANIES: Record<string, SampleCompany> = {
  General: {
    name: "Northgate",
    full: "Northgate & Company",
    descriptor: "& COMPANY",
    domain: "northgate.example",
    address: "14 Queens Road, Gaborone",
    symbol: "ring",
    serif: true,
    graphic: ["Our annual review is out", "Read what we did this year and where we go next"],
    person: { name: "Lesedi Molefe", title: "Head of Operations", department: "Operations" },
  },
  Legal: {
    name: "Kgosi Molefe",
    full: "Kgosi Molefe Attorneys",
    descriptor: "ATTORNEYS",
    domain: "kgosimolefe.example",
    address: "Plot 113, Kgale Mews, Gaborone",
    symbol: "columns",
    serif: true,
    graphic: ["Commercial law, plainly put", "Our new guide to company contracts in Botswana"],
    person: { name: "Naledi Kgosi", title: "Senior Associate", department: "Corporate" },
  },
  Finance: {
    name: "Mokolodi Capital",
    full: "Mokolodi Capital",
    descriptor: "WEALTH MANAGEMENT",
    domain: "mokolodicapital.example",
    address: "Block A, Fairgrounds Office Park, Gaborone",
    symbol: "bars",
    serif: true,
    graphic: ["Your mid-year review", "Book thirty minutes with your adviser this month"],
    person: { name: "Thabo Seretse", title: "Private Wealth Adviser", department: "Private clients" },
  },
  Healthcare: {
    name: "Riverside",
    full: "Riverside Family Clinic",
    descriptor: "FAMILY CLINIC",
    domain: "riversideclinic.example",
    address: "22 Nelson Mandela Drive, Francistown",
    symbol: "cross",
    serif: false,
    graphic: ["Flu vaccines are in", "Walk in Monday to Saturday, no booking needed"],
    person: { name: "Dr Kefilwe Tau", title: "General Practitioner", department: "Family medicine" },
  },
  "Real estate": {
    name: "Phakalane",
    full: "Phakalane Properties",
    descriptor: "PROPERTIES",
    domain: "phakalaneproperties.example",
    address: "Phakalane Golf Estate, Gaborone",
    symbol: "arch",
    serif: true,
    graphic: ["New on the market", "Four bedrooms on the golf estate. Viewing this Saturday"],
    person: { name: "Boitumelo Dube", title: "Property Consultant", department: "Residential sales" },
  },
  Technology: {
    name: "lumen",
    full: "Lumen Systems",
    descriptor: "SYSTEMS",
    domain: "lumensystems.example",
    address: "iTowers, CBD, Gaborone",
    symbol: "hexagon",
    serif: false,
    graphic: ["Lumen 4 is here", "Faster reports, and a new mobile app for field teams"],
    person: { name: "Kagiso Phiri", title: "Solutions Engineer", department: "Engineering" },
  },
  Education: {
    name: "Kgale Hill",
    full: "Kgale Hill Academy",
    descriptor: "ACADEMY",
    domain: "kgalehill.example",
    address: "Kgale View, Gaborone",
    symbol: "book",
    serif: true,
    graphic: ["Applications for 2027 are open", "Visit us on our open day, 14 November"],
    person: { name: "Mpho Sebina", title: "Head of Admissions", department: "Admissions" },
  },
  Hospitality: {
    name: "The Okavango",
    full: "The Okavango River Lodge",
    descriptor: "RIVER LODGE",
    domain: "okavangolodge.example",
    address: "Shorobe Road, Maun",
    symbol: "sun",
    serif: true,
    graphic: ["Green season rates", "Stay three nights and the fourth is on us"],
    person: { name: "Onalenna Ramotswa", title: "Guest Experience Manager", department: "Guest relations" },
  },
  Construction: {
    name: "BASALT",
    full: "Basalt Construction",
    descriptor: "CONSTRUCTION",
    domain: "basaltconstruction.example",
    address: "Plot 5643, Gaborone West Industrial",
    symbol: "beams",
    serif: false,
    graphic: ["412 days without a lost-time injury", "Thank you to every crew on every site"],
    person: { name: "Tumelo Keabetswe", title: "Site Manager", department: "Projects" },
  },
  Consulting: {
    name: "Meridian",
    full: "Meridian Advisory",
    descriptor: "ADVISORY",
    domain: "meridianadvisory.example",
    address: "Masa Centre, CBD, Gaborone",
    symbol: "compass",
    serif: true,
    graphic: ["The 2026 operations survey", "What 120 Southern African CFOs told us"],
    person: { name: "Lerato Nkwe", title: "Engagement Manager", department: "Strategy" },
  },
  Retail: {
    name: "marula",
    full: "Marula Home",
    descriptor: "HOME",
    domain: "marulahome.example",
    address: "Game City, Gaborone",
    symbol: "bag",
    serif: false,
    graphic: ["The summer collection", "Linen, clay and cane, in store and online now"],
    person: { name: "Dineo Mokoena", title: "Customer Care Lead", department: "Customer care" },
  },
  "Non-profit": {
    name: "Thuso",
    full: "Thuso Foundation",
    descriptor: "FOUNDATION",
    domain: "thusofoundation.example",
    address: "Extension 12, Gaborone",
    symbol: "hands",
    serif: true,
    graphic: ["1,200 school lunches a day", "Here is what your support did this term"],
    person: { name: "Masego Bogatsu", title: "Programme Coordinator", department: "Programmes" },
  },
  "Public sector": {
    name: "Office of Regional Services",
    full: "Office of Regional Services",
    descriptor: "SOUTH-EAST DISTRICT",
    domain: "regionalservices.example",
    address: "Civic Centre, Ramotswa",
    symbol: "shield",
    serif: true,
    graphic: ["Renew your licence online", "No queues. It takes about ten minutes"],
    person: { name: "Kabelo Moeng", title: "Senior Officer", department: "Licensing" },
  },
  Logistics: {
    name: "KALAHARI",
    full: "Kalahari Freight",
    descriptor: "FREIGHT",
    domain: "kalaharifreight.example",
    address: "Sir Seretse Khama Airport Cargo Village",
    symbol: "arrow",
    serif: false,
    graphic: ["Daily road freight to Johannesburg", "Collected by 4pm, delivered next morning"],
    person: { name: "Neo Dube", title: "Operations Controller", department: "Operations" },
  },
  Creative: {
    name: "Studio Sable",
    full: "Studio Sable",
    descriptor: "BRAND AND FILM",
    domain: "studiosable.example",
    address: "Old Naledi Arts Quarter, Gaborone",
    symbol: "quarter",
    serif: true,
    graphic: ["Our work for Marula Home", "A new identity, a campaign and three short films"],
    person: { name: "Amantle Kgari", title: "Executive Producer", department: "Production" },
  },
  "Mining and energy": {
    name: "Ridgeline",
    full: "Ridgeline Minerals",
    descriptor: "MINERALS",
    domain: "ridgelineminerals.example",
    address: "Mine Road, Jwaneng",
    symbol: "peak",
    serif: false,
    graphic: ["Zero harm, every shift", "Report every near miss. It keeps us all safe"],
    person: { name: "Oratile Sechele", title: "Safety Superintendent", department: "Safety, health and environment" },
  },
};

export const SAMPLE_COMPANY = COMPANIES.General.full;

export function sampleCompany(industry?: string | null): SampleCompany {
  return (industry && COMPANIES[industry]) || COMPANIES.General;
}

/** Simple geometric marks, drawn in a 40 by 40 box. */
function symbolSvg(symbol: Symbol, c: string): string {
  const s = `fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`;
  switch (symbol) {
    case "arch":
      return `<path d="M6 19 L20 7 L34 19" ${s}/><path d="M10 17 V33 H30 V17" ${s}/><path d="M17 33 V24 a3 3 0 0 1 6 0 V33" ${s}/>`;
    case "columns":
      return `<path d="M5 13 L20 5 L35 13 Z" fill="${c}"/><path d="M10 16 V30 M17 16 V30 M23 16 V30 M30 16 V30" ${s}/><rect x="5" y="32" width="30" height="3" fill="${c}"/>`;
    case "cross":
      return `<rect x="14" y="4" width="12" height="32" rx="3" fill="${c}"/><rect x="4" y="14" width="32" height="12" rx="3" fill="${c}"/><rect x="17.5" y="17.5" width="5" height="5" fill="#ffffff"/>`;
    case "hexagon":
      return `<path d="M20 4 L34 12 V28 L20 36 L6 28 V12 Z" fill="${c}"/><path d="M20 12 L27 16 V24 L20 28 L13 24 V16 Z" fill="#ffffff"/>`;
    case "book":
      return `<path d="M20 10 C15 6 9 6 5 8 V32 C9 30 15 30 20 34 C25 30 31 30 35 32 V8 C31 6 25 6 20 10 Z" fill="${c}"/><path d="M20 11 V33" stroke="#ffffff" stroke-width="1.6"/>`;
    case "sun":
      return `<circle cx="20" cy="24" r="8" fill="${c}"/><path d="M4 32 H36" ${s}/><path d="M20 6 V10 M8 12 L11 15 M32 12 L29 15" ${s}/>`;
    case "beams":
      return `<rect x="4" y="6" width="32" height="7" fill="${c}"/><rect x="4" y="16.5" width="20" height="7" fill="${c}"/><rect x="4" y="27" width="32" height="7" fill="${c}"/>`;
    case "compass":
      return `<circle cx="20" cy="20" r="15" ${s}/><path d="M20 7 L24 20 L20 33 L16 20 Z" fill="${c}"/>`;
    case "bag":
      return `<path d="M8 14 H32 L30 35 H10 Z" fill="${c}"/><path d="M14 14 V11 a6 6 0 0 1 12 0 V14" ${s}/>`;
    case "hands":
      return `<circle cx="15" cy="20" r="10" ${s}/><circle cx="25" cy="20" r="10" fill="${c}" fill-opacity="0.85"/>`;
    case "shield":
      return `<path d="M20 4 L34 9 V20 C34 28 28 33 20 36 C12 33 6 28 6 20 V9 Z" fill="${c}"/><path d="M13 20 L18 25 L27 15" stroke="#ffffff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "arrow":
      return `<path d="M4 12 H24 L34 20 L24 28 H4 L12 20 Z" fill="${c}"/>`;
    case "peak":
      return `<path d="M3 34 L15 12 L21 22 L26 15 L37 34 Z" fill="${c}"/><path d="M15 12 L18.5 18.5 L15 17 L12 19 Z" fill="#ffffff"/>`;
    case "quarter":
      return `<path d="M6 34 V6 A28 28 0 0 1 34 34 Z" fill="${c}"/>`;
    case "bars":
      return `<rect x="6" y="22" width="6" height="12" fill="${c}"/><rect x="17" y="14" width="6" height="20" fill="${c}"/><rect x="28" y="6" width="6" height="28" fill="${c}"/>`;
    case "ring":
      return `<circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="5"/><circle cx="20" cy="20" r="4" fill="${c}"/>`;
  }
}

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";

/**
 * A logo for the sample company: its mark, the name and a small
 * descriptor line. Drawn at twice its shown size, so it stays sharp.
 * A company typed in on the website gets the same treatment.
 */
export function sampleLogo(company: string, colour: string, c: SampleCompany = COMPANIES.General): ImageRef {
  const name = company.trim().slice(0, 28) || c.name;
  const descriptor = company.trim() && company.trim() !== c.name ? "" : c.descriptor;
  const font = c.serif ? SERIF : SANS;
  const nameSize = 40;
  const nameWidth = Math.round(name.length * nameSize * (c.serif ? 0.5 : 0.56));
  const descWidth = Math.round(descriptor.length * 15 * 0.82);
  const width = 84 + Math.max(nameWidth, descWidth) + 6;
  const height = 80;
  const nameY = descriptor ? 44 : 55;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<g transform="translate(0 4) scale(1.8)">${symbolSvg(c.symbol, colour)}</g>` +
    `<text x="84" y="${nameY}" font-family="${font}" font-size="${nameSize}" ${c.serif ? "" : 'font-weight="700" letter-spacing="-0.5"'} fill="${colour}">${xml(name)}</text>` +
    (descriptor ? `<text x="85" y="70" font-family="${SANS}" font-size="15" letter-spacing="3.4" fill="${colour}" fill-opacity="0.75">${xml(descriptor)}</text>` : "") +
    `</svg>`;
  return svgRef(svg, width, height);
}

/** A photo stand-in: the person's initials on a soft field of the brand colour. */
export function sampleAvatar(name: string, colour: string): ImageRef {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colour}" stop-opacity="0.92"/><stop offset="1" stop-color="${colour}"/></linearGradient></defs>` +
    `<rect width="200" height="200" fill="url(#g)"/>` +
    `<circle cx="100" cy="100" r="74" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>` +
    `<text x="100" y="121" text-anchor="middle" font-family="${SERIF}" font-size="62" fill="#ffffff">${xml(initials(name))}</text>` +
    `</svg>`;
  return svgRef(svg, 200, 200);
}

/** A promotional graphic of the kind a company would put under a signature. */
export function sampleGraphic(c: SampleCompany, colour: string, secondary: string): ImageRef {
  const [headline, line] = c.graphic;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="220" viewBox="0 0 960 220">` +
    `<rect width="960" height="220" rx="10" fill="${colour}"/>` +
    `<circle cx="860" cy="40" r="150" fill="none" stroke="${secondary}" stroke-opacity="0.35" stroke-width="2"/>` +
    `<circle cx="860" cy="40" r="105" fill="none" stroke="${secondary}" stroke-opacity="0.25" stroke-width="2"/>` +
    `<rect x="48" y="52" width="40" height="3" fill="${secondary}"/>` +
    `<text x="48" y="118" font-family="${SERIF}" font-size="44" fill="#ffffff">${xml(headline)}</text>` +
    `<text x="48" y="160" font-family="${SANS}" font-size="22" fill="#ffffff" fill-opacity="0.82">${xml(line)}</text>` +
    `</svg>`;
  return svgRef(svg, 960, 220);
}

export interface SampleInput {
  company?: string;
  website?: string;
  name?: string;
  title?: string;
  primary?: string;
  font?: FontKey;
  /** Picks the made-up company that suits the template. */
  industry?: string;
  /** A logo the visitor chose on the website, in place of the sample one. */
  logo?: ImageRef | null;
  /** A photo the visitor chose. */
  photo?: ImageRef | null;
}

/** northgate.example, or one made from the company name typed in. */
export function sampleDomain(company: string | undefined, industry?: string): string {
  const slug = (company ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  return slug ? `${slug}.example` : sampleCompany(industry).domain;
}

export function sampleBrand(p: Palette, input: SampleInput = {}): BrandData {
  const c = sampleCompany(input.industry);
  const primary = safeColour(input.primary, p.primary);
  const typed = input.company?.trim();
  const company = typed || c.full;
  return {
    colours: { primary, secondary: p.secondary, text: "#1C2230", muted: "#5F6470" },
    font: input.font ?? (c.serif ? "georgia" : "arial"),
    company,
    website: input.website?.trim() || sampleDomain(input.company, input.industry),
    address: c.address,
    disclaimer: `This email and anything attached to it are confidential. ${company} is a made-up company used to show Tshaeno templates.`,
    socials: [
      { network: "linkedin", url: "https://www.linkedin.com/company/example" },
      { network: "instagram", url: "https://www.instagram.com/example" },
      { network: "facebook", url: "https://www.facebook.com/example" },
    ],
    logo: input.logo ?? sampleLogo(typed ?? "", primary, c),
  };
}

export function samplePerson(p: Palette, input: SampleInput = {}): PersonData {
  const c = sampleCompany(input.industry);
  const full = input.name?.trim() || c.person.name;
  const parts = full.split(/\s+/);
  const [firstName, ...rest] = parts[0] === "Dr" && parts.length > 2 ? [`${parts[0]} ${parts[1]}`, ...parts.slice(2)] : parts;
  const local = (firstName.split(" ").pop() ?? "").toLowerCase().replace(/[^a-z]/g, "") || "hello";
  return {
    firstName,
    lastName: rest.join(" "),
    email: `${local}@${sampleDomain(input.company, input.industry)}`,
    title: input.title?.trim() || c.person.title,
    department: c.person.department,
    location: c.address.split(", ").pop() ?? "Gaborone",
    phone: "+267 390 1234",
    mobile: "+267 71 234 567",
    photo: input.photo ?? sampleAvatar(full, safeColour(input.primary, p.primary)),
    custom: {},
  };
}

/** Stands in for a logo that hasn't been uploaded yet, in the app's template gallery. */
export function logoPlaceholder(company: string, colour: string): ImageRef {
  const name = company.trim().slice(0, 28) || "Your logo";
  const width = Math.max(220, 40 + Math.round(name.length * 19));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="72" viewBox="0 0 ${width} 72">` +
    `<rect x="1" y="1" width="${width - 2}" height="70" rx="8" fill="#ffffff" stroke="${colour}" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="6 5"/>` +
    `<text x="${width / 2}" y="44" text-anchor="middle" font-family="${SERIF}" font-size="30" fill="${colour}">${xml(name)}</text>` +
    `</svg>`;
  return svgRef(svg, width, 72);
}

/** Stands in for the company's own graphic, in the app's template gallery. */
export function graphicPlaceholder(colour: string): ImageRef {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="200" viewBox="0 0 960 200">` +
    `<rect x="2" y="2" width="956" height="196" rx="10" fill="#f7f5f1" stroke="${colour}" stroke-opacity="0.4" stroke-width="3" stroke-dasharray="10 8"/>` +
    `<text x="480" y="96" text-anchor="middle" font-family="${SERIF}" font-size="38" fill="${colour}">Your own graphic goes here</text>` +
    `<text x="480" y="138" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${colour}" fill-opacity="0.7">A banner, an award or an event poster. Upload it in the studio.</text>` +
    `</svg>`;
  return svgRef(svg, 960, 200);
}

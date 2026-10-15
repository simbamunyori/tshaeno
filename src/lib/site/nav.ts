import { INDUSTRIES, type Industry } from "@/lib/signature/starters";

/** The website's menus. Kept as data so the header and the footer list the same pages. */

export interface NavLink {
  href: string;
  label: string;
  text?: string;
}

export function industrySlug(industry: Industry): string {
  return industry === "General" ? "small-business" : industry.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export const INDUSTRY_LABEL = (i: Industry) => (i === "General" ? "Small business" : i);

export const TEAMS: NavLink[] = [
  { href: "/solutions/it", label: "IT", text: "Set it up once and stop hearing about signatures" },
  { href: "/solutions/marketing", label: "Marketing", text: "Your brand on every email, and campaigns that run themselves" },
  { href: "/solutions/sales", label: "Sales", text: "Turn every reply into a way to book the next meeting" },
  { href: "/solutions/hr", label: "HR and leadership", text: "Everyone looks like part of the same company" },
];

export const INDUSTRY_LINKS: NavLink[] = INDUSTRIES.map((i) => ({ href: `/solutions/${industrySlug(i)}`, label: INDUSTRY_LABEL(i) }));

export const PRODUCT: NavLink[] = [
  { href: "/#product", label: "Email signatures", text: "One design for everyone, filled in from your directory" },
  { href: "/templates", label: "Templates", text: "32 designs to start from, with your own logo" },
  { href: "/solutions/marketing", label: "Campaigns", text: "Graphics under every signature, on a schedule, with clicks counted" },
  { href: "/tools/disclaimer", label: "Email disclaimers", text: "The same wording on every email, changed in one place" },
  { href: "/tools/meeting-background", label: "Meeting backgrounds", text: "Branded backgrounds for Zoom, Teams and Meet" },
  { href: "/tools/out-of-office", label: "Out-of-office messages", text: "Replies that tell people what to do next" },
];

export const RESOURCES: NavLink[] = [
  { href: "/guides", label: "Guides", text: "Practical advice on signatures, disclaimers and more" },
  { href: "/tools", label: "Free tools", text: "Meeting backgrounds, out-of-office and disclaimer writers" },
  { href: "/compare", label: "Tshaeno or built-in signatures", text: "What changes when one person manages them" },
  { href: "/demo", label: "Book a demo", text: "Half an hour with us, with your own logo" },
];

import type { BrandColours, ColourRef, FontKey, TextSize } from "./types";

/** Font stacks every mail client has, with fallbacks. */
export const FONTS: Record<FontKey, { label: string; stack: string }> = {
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  helvetica: { label: "Helvetica", stack: "Helvetica, Arial, sans-serif" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  tahoma: { label: "Tahoma", stack: "Tahoma, Verdana, sans-serif" },
  trebuchet: { label: "Trebuchet MS", stack: "'Trebuchet MS', Arial, sans-serif" },
  segoe: { label: "Segoe UI", stack: "'Segoe UI', Tahoma, Arial, sans-serif" },
  georgia: { label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  times: { label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  courier: { label: "Courier New", stack: "'Courier New', Courier, monospace" },
};

export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

const SCALE: Record<TextSize, number> = { xs: 0.77, sm: 0.86, md: 1, lg: 1.2, xl: 1.45 };

export function textPx(size: TextSize, base: number): number {
  return Math.round(base * SCALE[size]);
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(v: string): boolean {
  return HEX.test(v);
}

/** Expands #abc to #aabbcc and lower-cases it. */
export function normaliseHex(v: string): string {
  const m = HEX.exec(v.trim());
  if (!m) return "#000000";
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${h.toLowerCase()}`;
}

export function resolveColour(ref: ColourRef, colours: BrandColours): string {
  if (ref.startsWith("#")) return normaliseHex(ref);
  return normaliseHex(colours[ref as keyof BrandColours] ?? "#000000");
}

function channels(hex: string): [number, number, number] {
  const h = normaliseHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** The dark backgrounds Outlook, Gmail and Apple Mail use. */
export const DARK_BACKGROUND = "#1f1f1f";
export const LIGHT_BACKGROUND = "#ffffff";

/**
 * Roughly what Outlook and the Gmail apps do to text colours in dark
 * mode: a colour too dark to read on a dark background has its lightness
 * flipped, keeping its hue. Light enough colours are left alone.
 */
export function darkModeColour(hex: string): string {
  if (contrast(hex, DARK_BACKGROUND) >= 4.5) return normaliseHex(hex);
  const [r, g, b] = channels(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const nl = Math.min(0.92, Math.max(0.62, 1 - l));
  const c = (1 - Math.abs(2 * nl - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = nl - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Makes a link safe to put in an href: http(s), mailto and tel only.
 * A bare domain such as example.com becomes https://example.com.
 */
export function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(mailto|tel):/i.test(v)) return v.replace(/\s+/g, "");
  if (/^https?:\/\//i.test(v)) return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v) ? v : null;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s]*)?$/i.test(v)) return `https://${v}`;
  return null;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** A website shown without its scheme and trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "www.").replace(/\/$/, "");
}

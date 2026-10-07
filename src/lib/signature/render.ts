import { fieldValues, fill, fillLines } from "./fields";
import { FONTS, displayUrl, escapeHtml, resolveColour, safeHref, telHref, textPx } from "./style";
import type {
  Align,
  Block,
  ColourRef,
  ColumnsBlock,
  ContactKind,
  ImageRef,
  ImageShape,
  RenderContext,
  SignatureDoc,
  SocialNetwork,
} from "./types";

/**
 * Turns a signature document into HTML that survives Outlook's Word
 * engine, Gmail's sanitiser and Apple Mail: tables for layout, every
 * style inline, sizes on every image, nothing that needs a <style> tag.
 */

export interface Rendered {
  html: string;
  text: string;
}

const TABLE = 'cellpadding="0" cellspacing="0" border="0" role="presentation"';
const GAP = 4;

interface Ctx extends RenderContext {
  values: Record<string, string>;
  font: string;
  base: number;
  text: string[];
}

export const SOCIAL_LABEL: Record<SocialNetwork, string> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  github: "GitHub",
  whatsapp: "WhatsApp",
  threads: "Threads",
};

export const CONTACT_LABEL: Record<ContactKind, { label: string; letter: string }> = {
  phone: { label: "Phone", letter: "T" },
  mobile: { label: "Mobile", letter: "M" },
  email: { label: "Email", letter: "E" },
  website: { label: "Website", letter: "W" },
  address: { label: "Address", letter: "A" },
};

function colour(ctx: Ctx, ref: ColourRef): string {
  return resolveColour(ref, ctx.brand.colours);
}

function textStyle(ctx: Ctx, px: number, colourHex: string, extra = ""): string {
  const lh = Math.round(px * 1.4);
  return `font-family:${ctx.font};font-size:${px}px;line-height:${lh}px;mso-line-height-rule:exactly;color:${colourHex};${extra}`;
}

function cell(content: string, align: Align, padBottom = GAP): string {
  const pad = padBottom ? `padding:0 0 ${padBottom}px 0;` : "padding:0;";
  return `<tr><td align="${align}" style="${pad}text-align:${align}">${content}</td></tr>`;
}

/** Aligns block-level content such as an image or a small table. */
function aligned(content: string, align: Align): string {
  if (align === "left") return content;
  return `<table ${TABLE} align="${align}" style="border-collapse:collapse"><tr><td>${content}</td></tr></table>`;
}

function img(ref: ImageRef, width: number, alt: string, shape: ImageShape = "square"): string {
  const w = Math.max(8, Math.round(width));
  const h = Math.max(1, Math.round((w * ref.height) / ref.width));
  const radius = shape === "circle" ? "border-radius:50%;" : shape === "rounded" ? "border-radius:8px;" : "";
  return `<img src="${escapeHtml(ref.url)}" width="${w}" height="${h}" alt="${escapeHtml(alt)}" style="display:block;border:0;outline:none;text-decoration:none;width:${w}px;height:${h}px;${radius}">`;
}

function link(href: string | null, inner: string, style = ""): string {
  if (!href) return inner;
  return `<a href="${escapeHtml(href)}" target="_blank" style="text-decoration:none;${style}">${inner}</a>`;
}

function iconUrl(ctx: Ctx, kind: string, hex: string): string {
  return `${ctx.origin}/i/icon/${kind}/${hex.slice(1)}.png`;
}

function socialUrl(ctx: Ctx, network: SocialNetwork, hex: string): string {
  return `${ctx.origin}/i/social/${network}/${hex.slice(1)}.png`;
}

function contactValue(ctx: Ctx, kind: ContactKind): { text: string; href: string | null } | null {
  const v = (ctx.values[kind === "mobile" ? "mobile" : kind] ?? "").trim();
  if (!v) return null;
  switch (kind) {
    case "phone":
    case "mobile":
      return { text: v, href: telHref(v) };
    case "email":
      return { text: v, href: `mailto:${v}` };
    case "website":
      return { text: displayUrl(v), href: safeHref(v) };
    case "address":
      return { text: v, href: null };
  }
}

function renderBlocks(ctx: Ctx, blocks: Block[]): string {
  return blocks.map((b) => renderBlock(ctx, b)).join("");
}

function renderBlock(ctx: Ctx, b: Block): string {
  switch (b.type) {
    case "text": {
      const lines = fillLines(b.text, ctx.values).filter((l, i, all) => l.trim() || (i > 0 && i < all.length - 1));
      if (!lines.some((l) => l.trim())) return "";
      ctx.text.push(...lines);
      const px = textPx(b.size, ctx.base);
      const extra = `${b.bold ? "font-weight:bold;" : ""}${b.italic ? "font-style:italic;" : ""}${b.uppercase ? "text-transform:uppercase;letter-spacing:1px;" : ""}`;
      const body = lines.map(escapeHtml).join("<br>");
      return `<tr><td align="${b.align}" style="padding:0 0 ${GAP}px 0;text-align:${b.align};${textStyle(ctx, px, colour(ctx, b.colour), extra)}">${body}</td></tr>`;
    }
    case "image": {
      const ref = b.source === "logo" ? ctx.brand.logo : b.source === "photo" ? ctx.person.photo : b.assetId ? ctx.assets[b.assetId] : null;
      if (!ref) return "";
      const alt = b.source === "photo" ? ctx.values.name || "Photo" : ctx.brand.company || "Logo";
      const href = safeHref(fill(b.link, ctx.values));
      return cell(aligned(link(href, img(ref, b.width, alt, b.shape)), b.align), b.align);
    }
    case "banner": {
      const ref = b.assetId ? ctx.assets[b.assetId] : null;
      if (!ref) return "";
      const href = safeHref(fill(b.link, ctx.values));
      if (href) ctx.text.push(href);
      return cell(aligned(link(href, img(ref, b.width, b.alt || ctx.brand.company || "Banner")), b.align), b.align);
    }
    case "contacts": {
      const items = b.items.map((k) => [k, contactValue(ctx, k)] as const).filter((x): x is [ContactKind, { text: string; href: string | null }] => !!x[1]);
      if (!items.length) return "";
      const px = textPx(b.size, ctx.base);
      const ink = colour(ctx, b.colour);
      const accent = colour(ctx, b.accent);
      const iconPx = Math.round(px * 1.05);
      const label = (k: ContactKind) =>
        b.labels === "icons"
          ? img({ url: iconUrl(ctx, k, accent), width: 64, height: 64 }, iconPx, CONTACT_LABEL[k].label)
          : b.labels === "letters"
            ? `<span style="${textStyle(ctx, px, accent, "font-weight:bold;")}">${CONTACT_LABEL[k].letter}</span>`
            : "";
      const value = (v: { text: string; href: string | null }) =>
        `<span style="${textStyle(ctx, px, ink)}">${link(v.href, escapeHtml(v.text), `color:${ink};`)}</span>`;
      for (const [k, v] of items) ctx.text.push(b.labels === "none" ? v.text : `${CONTACT_LABEL[k].letter}: ${v.text}`);

      if (b.layout === "stacked") {
        const rows = items
          .map(([k, v]) => {
            const lab = label(k);
            const labCell = lab ? `<td valign="middle" width="${iconPx + 8}" style="width:${iconPx + 8}px;padding:0 0 2px 0">${lab}</td>` : "";
            return `<tr>${labCell}<td valign="middle" style="padding:0 0 2px 0;${textStyle(ctx, px, ink)}">${value(v)}</td></tr>`;
          })
          .join("");
        return cell(aligned(`<table ${TABLE} style="border-collapse:collapse">${rows}</table>`, b.align), b.align);
      }
      // One line that wraps between items on narrow screens, never inside one.
      const sep = `<span style="color:${colour(ctx, "muted")}">&nbsp;&nbsp;|&nbsp;&nbsp;</span> `;
      const inlineLabel = (k: ContactKind) =>
        b.labels === "icons"
          ? `<img src="${escapeHtml(iconUrl(ctx, k, accent))}" width="${iconPx}" height="${iconPx}" alt="${CONTACT_LABEL[k].label}" style="display:inline-block;vertical-align:middle;border:0;width:${iconPx}px;height:${iconPx}px">&nbsp;`
          : b.labels === "letters"
            ? `<span style="color:${accent};font-weight:bold">${CONTACT_LABEL[k].letter}</span>&nbsp;`
            : "";
      const line = items
        .map(([k, v]) => `<span style="white-space:nowrap">${inlineLabel(k)}${link(v.href, escapeHtml(v.text), `color:${ink};`)}</span>`)
        .join(sep);
      return `<tr><td align="${b.align}" style="padding:0 0 ${GAP}px 0;text-align:${b.align};${textStyle(ctx, px, ink)}">${line}</td></tr>`;
    }
    case "socials": {
      const links = ctx.brand.socials
        .map((s) => ({ ...s, url: safeHref(ctx.person.custom[s.network] || s.url) }))
        .filter((s): s is { network: SocialNetwork; url: string } => !!s.url);
      if (!links.length) return "";
      const hex = colour(ctx, b.colour);
      const cells = links
        .map(
          (s, i) =>
            `<td style="padding:0 ${i === links.length - 1 ? 0 : 6}px 0 0">${link(s.url, img({ url: socialUrl(ctx, s.network, hex), width: 64, height: 64 }, b.size, SOCIAL_LABEL[s.network]))}</td>`,
        )
        .join("");
      return cell(aligned(`<table ${TABLE} style="border-collapse:collapse"><tr>${cells}</tr></table>`, b.align), b.align);
    }
    case "divider": {
      const c = colour(ctx, b.colour);
      const t = b.thickness;
      const pct = Math.min(100, Math.max(10, Math.round(b.width)));
      const line = `<table ${TABLE} width="${pct}%" align="${b.align}" style="border-collapse:collapse;width:${pct}%"><tr><td height="${t}" bgcolor="${c}" style="height:${t}px;line-height:${t}px;font-size:1px;background-color:${c}">&nbsp;</td></tr></table>`;
      return `<tr><td align="${b.align}" style="padding:6px 0 ${6 + GAP}px 0">${line}</td></tr>`;
    }
    case "spacer": {
      const h = Math.min(64, Math.max(2, Math.round(b.height)));
      return `<tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</td></tr>`;
    }
    case "button": {
      const href = safeHref(fill(b.url, ctx.values));
      const label = fill(b.label, ctx.values).trim();
      if (!href || !label) return "";
      ctx.text.push(`${label}: ${href}`);
      const bg = colour(ctx, b.colour);
      const fg = colour(ctx, b.textColour);
      const px = textPx("sm", ctx.base);
      const radius = b.rounded ? "border-radius:4px;" : "";
      const btn = `<table ${TABLE} style="border-collapse:separate"><tr><td bgcolor="${bg}" style="background-color:${bg};${radius}padding:7px 14px">${link(href, escapeHtml(label), `color:${fg};${textStyle(ctx, px, fg, "font-weight:bold;")}`)}</td></tr></table>`;
      return cell(aligned(btn, b.align), b.align, GAP + 2);
    }
    case "disclaimer": {
      const lines = fillLines(ctx.brand.disclaimer, ctx.values);
      if (!lines.some((l) => l.trim())) return "";
      ctx.text.push("", ...lines);
      const px = textPx(b.size, ctx.base);
      return `<tr><td align="${b.align}" style="padding:4px 0 ${GAP}px 0;text-align:${b.align};${textStyle(ctx, px, colour(ctx, b.colour))}">${lines.map(escapeHtml).join("<br>")}</td></tr>`;
    }
    case "columns":
      return renderColumns(ctx, b);
  }
}

function renderColumns(ctx: Ctx, b: ColumnsBlock): string {
  const left = renderBlocks(ctx, b.left);
  const right = renderBlocks(ctx, b.right);
  if (!left && !right) return "";
  const wrap = (rows: string) => `<table ${TABLE} style="border-collapse:collapse">${rows}</table>`;
  if (!left || !right) return `<tr><td style="padding:0">${wrap(left || right)}</td></tr>`;
  const w = Math.round(b.leftWidth);
  const gap = Math.round(b.gap);
  const rule = b.rule ? `border-left:1px solid ${colour(ctx, b.ruleColour)};` : "";
  return (
    `<tr><td style="padding:0 0 ${GAP}px 0"><table ${TABLE} style="border-collapse:collapse"><tr>` +
    `<td valign="${b.valign}" width="${w}" style="width:${w}px;padding:0 ${gap}px 0 0;vertical-align:${b.valign}">${wrap(left)}</td>` +
    `<td valign="${b.valign}" style="${rule}padding:0 0 0 ${b.rule ? gap : 0}px;vertical-align:${b.valign}">${wrap(right)}</td>` +
    `</tr></table></td></tr>`
  );
}

export function renderSignature(doc: SignatureDoc, context: RenderContext): Rendered {
  const ctx: Ctx = {
    ...context,
    values: fieldValues(context.person, context.brand),
    font: FONTS[context.brand.font]?.stack ?? FONTS.arial.stack,
    base: Math.min(16, Math.max(11, Math.round(doc.baseSize))),
    text: [],
  };
  const rows = renderBlocks(ctx, doc.blocks);
  const width = Math.min(640, Math.max(280, Math.round(doc.width)));
  const html = `<table ${TABLE} style="border-collapse:collapse;border-spacing:0;max-width:${width}px;font-family:${ctx.font}">${rows}</table>`;
  const text = ctx.text
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { html, text };
}

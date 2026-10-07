import sanitizeHtml from "sanitize-html";
import { fieldValues } from "./fields";
import { escapeHtml } from "./style";
import type { RenderContext } from "./types";
import type { Rendered } from "./render";

/**
 * Full HTML mode. People can paste any signature HTML; it is cleaned to
 * what mail clients allow, then each {{field}} is filled with the
 * person's escaped value, then cleaned again so a value can never become
 * markup or a dangerous link.
 */

const UNSAFE_CSS = /expression\s*\(|javascript:|vbscript:|url\s*\(|@import|behavior\s*:|-moz-binding/i;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "a", "img", "span", "b", "strong", "i", "em", "u", "s",
    "br", "p", "div", "font", "center", "hr", "small", "sup", "sub", "h1", "h2", "h3", "h4",
  ],
  allowedAttributes: {
    "*": ["style", "align", "valign", "width", "height", "bgcolor", "dir", "title", "role", "class"],
    table: ["cellpadding", "cellspacing", "border"],
    td: ["colspan", "rowspan", "nowrap"],
    th: ["colspan", "rowspan", "nowrap"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "border"],
    font: ["color", "face", "size"],
  },
  allowedSchemes: ["https", "http", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // An image whose source was unsafe is dropped rather than left empty.
  exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  // Everything inside these goes, not just the tags.
  nonTextTags: ["style", "script", "textarea", "option", "noscript", "title", "head", "svg", "math", "iframe", "object"],
  transformTags: {
    "*": (tagName, attribs) => {
      if (attribs.style && UNSAFE_CSS.test(attribs.style)) {
        const { style: _drop, ...rest } = attribs;
        void _drop;
        return { tagName, attribs: rest };
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizeSignatureHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

const TOKEN = /\{\{\s*([a-zA-Z][\w.-]*)\s*\}\}/g;

export function renderHtmlSignature(html: string, context: Pick<RenderContext, "person" | "brand">): Rendered {
  const values = fieldValues(context.person, context.brand);
  const filled = sanitizeSignatureHtml(html).replace(TOKEN, (_, key: string) => escapeHtml((values[key] ?? "").trim()));
  const clean = sanitizeSignatureHtml(filled);
  const text = sanitizeHtml(clean.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|h\d)>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  return { html: clean, text };
}

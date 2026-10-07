import { Parser } from "htmlparser2";
import { contrast, DARK_BACKGROUND, isHex, LIGHT_BACKGROUND, normaliseHex } from "./style";

/**
 * Checks signature HTML against what Outlook (the Word engine on
 * Windows), Gmail and Apple Mail actually support. The same checks run
 * in the studio, for people writing their own HTML, and in the test
 * suite against every starter template.
 */

export type Client = "outlook" | "gmail" | "apple";
export type Severity = "error" | "warning" | "note";

export interface Issue {
  rule: string;
  severity: Severity;
  clients: Client[];
  message: string;
}

export interface CheckResult {
  issues: Issue[];
  /** fail: something breaks; warn: it works but looks off; pass: fine. */
  clients: Record<Client, "pass" | "warn" | "fail">;
  characters: number;
}

export const CLIENT_LABEL: Record<Client, string> = { outlook: "Outlook", gmail: "Gmail", apple: "Apple Mail" };

/** Gmail refuses signatures longer than this. */
export const GMAIL_SIGNATURE_LIMIT = 10_000;

const ALL: Client[] = ["outlook", "gmail", "apple"];

function declarations(style: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of style.split(";")) {
    const i = part.indexOf(":");
    if (i < 1) continue;
    out.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim().toLowerCase());
  }
  return out;
}

export function checkSignatureHtml(html: string): CheckResult {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (rule: string, severity: Severity, clients: Client[], message: string) => {
    if (seen.has(rule)) return;
    seen.add(rule);
    issues.push({ rule, severity, clients, message });
  };
  /** Text colours, each with the background it sits on (null: the email's own). */
  const textColours = new Map<string, string | null>();
  const backgrounds: (string | null)[] = [];
  let hasTable = false;
  let layoutDivs = 0;

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const css = declarations(attrs.style ?? "");
        const ownBg = [attrs.bgcolor, css.get("background-color"), css.get("background")].find((v) => v && isHex(v));
        const bg = ownBg ? normaliseHex(ownBg) : (backgrounds.at(-1) ?? null);
        backgrounds.push(bg);
        if (name === "style" || name === "link") add("style-tag", "error", ["gmail", "outlook"], "Styles in a <style> tag or stylesheet are removed by Gmail. Put every style inline.");
        if (name === "script" || name === "iframe" || name === "form" || name === "input") add("active-content", "error", ALL, "Scripts, frames and forms are removed by every mail client.");
        if (name === "svg") add("svg", "error", ["outlook", "gmail"], "Outlook and Gmail don't show SVG. Use PNG or JPEG images.");
        if (name === "table") hasTable = true;
        if ((name === "div" || name === "p") && (css.has("width") || css.has("display"))) layoutDivs++;
        if (attrs.class) add("class", "warning", ["gmail"], "Gmail ignores class names, so anything styled by a class loses its style.");

        if (name === "img") {
          const src = (attrs.src ?? "").trim();
          if (!src) add("img-src", "error", ALL, "An image has no source.");
          else if (/^data:/i.test(src)) add("img-data", "error", ["gmail", "outlook"], "Images embedded as data are removed by Gmail and blocked by Outlook. Upload the image instead.");
          else if (/\.svg(\?|$)/i.test(src)) add("svg", "error", ["outlook", "gmail"], "Outlook and Gmail don't show SVG. Use PNG or JPEG images.");
          else if (/^http:\/\//i.test(src)) add("img-http", "warning", ALL, "An image loads over http. Mail clients may block it; use https.");
          else if (!/^https:\/\//i.test(src)) add("img-relative", "error", ALL, "An image address isn't a full https link, so it won't load in email.");
          if (!attrs.width || (!attrs.height && !css.has("height"))) add("img-size", "error", ["outlook"], "An image has no width and height attributes. Outlook shows it at full size.");
          if (attrs.alt === undefined) add("img-alt", "warning", ALL, "An image has no alt text, shown when images are blocked.");
        }
        if (name === "a") {
          const href = (attrs.href ?? "").trim();
          if (href && !/^(https?:|mailto:|tel:)/i.test(href)) add("href", "error", ALL, `A link uses an address mail clients won't open: ${href.slice(0, 40)}`);
        }

        const display = css.get("display") ?? "";
        if (/flex|grid/.test(display)) add("flex", "error", ["outlook"], "Flexbox and grid layouts fall apart in Outlook. Use tables.");
        if (css.has("position")) add("position", "error", ["outlook", "gmail"], "Positioned elements are removed by Gmail and Outlook.");
        if (css.has("float")) add("float", "warning", ["outlook"], "Outlook ignores float. Use table cells side by side.");
        for (const v of css.values()) {
          if (v.includes("var(")) add("css-var", "error", ["outlook", "gmail"], "CSS variables aren't supported by Outlook or Gmail.");
          if (v.includes("url(")) add("bg-image", "error", ["outlook"], "Background images don't show in Outlook.");
        }
        if (css.has("background-image")) add("bg-image", "error", ["outlook"], "Background images don't show in Outlook.");
        if (css.has("max-width") && !css.has("width") && !attrs.width && name !== "table") add("max-width", "warning", ["outlook"], "Outlook ignores max-width. Set a width as well.");
        if ((name === "div" || name === "p" || name === "a" || name === "span") && [...css.keys()].some((k) => k.startsWith("padding")))
          add("inline-padding", "warning", ["outlook"], "Outlook ignores padding on links, paragraphs and divs. Put padding on table cells.");
        if ((name === "div" || name === "p") && [...css.keys()].some((k) => k.startsWith("margin")))
          add("margin", "note", ["outlook"], "Outlook handles margins unevenly. Spacer rows are steadier.");
        if (css.has("border-radius")) add("radius", "note", ["outlook"], "Outlook on Windows shows square corners instead of rounded ones.");
        if (css.has("box-shadow")) add("shadow", "note", ["outlook", "gmail"], "Shadows don't show in Outlook or Gmail.");
        if (/@font-face/.test(attrs.style ?? "")) add("webfont", "error", ALL, "Web fonts don't load in signatures.");

        const c = css.get("color");
        if (c && isHex(c)) textColours.set(`${normaliseHex(c)}|${bg ?? ""}`, bg);
        if (name === "font" && attrs.color && isHex(attrs.color)) textColours.set(`${normaliseHex(attrs.color)}|${bg ?? ""}`, bg);
      },
      onclosetag() {
        backgrounds.pop();
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();

  if (!hasTable && layoutDivs > 0) add("div-layout", "warning", ["outlook"], "The layout uses divs with widths. Outlook lays out tables far more reliably.");

  const characters = html.length;
  if (characters > GMAIL_SIGNATURE_LIMIT)
    add("gmail-length", "error", ["gmail"], `Gmail signatures can hold ${GMAIL_SIGNATURE_LIMIT.toLocaleString("en")} characters; this one has ${characters.toLocaleString("en")}.`);

  for (const [key, bg] of textColours) {
    const c = key.split("|")[0];
    if (bg) {
      if (contrast(c, bg) < 3) add("bg-contrast", "warning", ALL, `Text in ${c} is hard to read on ${bg}.`);
      continue;
    }
    if (contrast(c, LIGHT_BACKGROUND) < 3) {
      add("light-contrast", "warning", ALL, `Text in ${c} is hard to read on a white background.`);
    }
    if (contrast(c, DARK_BACKGROUND) < 1.6 && contrast(c, LIGHT_BACKGROUND) >= 3) {
      add("dark-contrast", "note", ["apple"], `Apple Mail in dark mode keeps text colours as they are, so ${c} text may be hard to read there.`);
    }
  }

  const clients = Object.fromEntries(
    ALL.map((client) => {
      const mine = issues.filter((i) => i.clients.includes(client));
      return [client, mine.some((i) => i.severity === "error") ? "fail" : mine.some((i) => i.severity === "warning") ? "warn" : "pass"];
    }),
  ) as CheckResult["clients"];
  return { issues, clients, characters };
}

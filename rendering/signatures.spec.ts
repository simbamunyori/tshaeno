import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { SAMPLE_PERSON } from "../src/lib/signature/fields";
import { frameDoc } from "../src/lib/signature/frame";
import { renderHtmlSignature } from "../src/lib/signature/html-mode";
import { renderSignature } from "../src/lib/signature/render";
import { HTML_STARTER, STARTERS } from "../src/lib/signature/starters";
import type { BrandData, PersonData } from "../src/lib/signature/types";
import { contactIcon, hexFromFile, socialIcon } from "../src/server/signatures/icons";

/**
 * Draws every starter in a real browser engine and checks what a reader
 * would notice: every image loads, nothing runs off the side of a phone
 * or a desktop reading pane, and text stays readable on light and dark
 * backgrounds. Screenshots are kept with the test results.
 */

const ORIGIN = "https://render.tshaeno.test";

const BRAND: BrandData = {
  colours: { primary: "#0B7F78", secondary: "#2EC4B6", text: "#0B1F3A", muted: "#5A6472" },
  font: "arial",
  company: "Kalahari Freight",
  website: "kalaharifreight.co.bw",
  address: "Plot 50369, Fairgrounds Office Park, Gaborone",
  disclaimer: "This email and anything attached to it are confidential and meant only for the person named above.",
  socials: [
    { network: "linkedin", url: "https://www.linkedin.com/company/kalahari" },
    { network: "x", url: "https://x.com/kalahari" },
    { network: "instagram", url: "https://instagram.com/kalahari" },
    { network: "youtube", url: "https://youtube.com/@kalahari" },
  ],
  logo: { url: `${ORIGIN}/i/a/logo.png`, width: 600, height: 160 },
};

const PERSON: PersonData = {
  ...SAMPLE_PERSON,
  title: "Head of Regional Operations and Logistics",
  photo: { url: `${ORIGIN}/i/a/photo.jpg`, width: 320, height: 320 },
};

let images: Promise<Record<string, Buffer>> | null = null;
function sampleImages() {
  images ??= Promise.all([
    sharp({ create: { width: 600, height: 160, channels: 4, background: { r: 11, g: 31, b: 58, alpha: 1 } } }).png().toBuffer(),
    sharp({ create: { width: 320, height: 320, channels: 3, background: { r: 46, g: 196, b: 182 } } }).jpeg().toBuffer(),
  ]).then(([logo, photo]) => ({ "logo.png": logo, "photo.jpg": photo }));
  return images;
}

/** Serves the signature's images the way the app does, with no network. */
async function serveImages(page: Page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/").filter(Boolean);
    let body: Buffer | null | undefined = null;
    if (parts[1] === "a") body = (await sampleImages())[parts[2]];
    else if (parts[1] === "icon" || parts[1] === "social") {
      const hex = hexFromFile(parts[3]);
      body = hex ? await (parts[1] === "icon" ? contactIcon(parts[2], hex) : socialIcon(parts[2], hex)) : null;
    }
    if (!body) return route.fulfill({ status: 404 });
    return route.fulfill({ status: 200, contentType: parts[2].endsWith(".jpg") ? "image/jpeg" : "image/png", body });
  });
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour and the background behind it, for every piece of text in the signature. */
async function textColours(page: Page) {
  return page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return a === 0 ? null : [r, g, b];
    };
    const bgOf = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const bg = parse(getComputedStyle(e).backgroundColor);
        if (bg) return bg;
      }
      return [255, 255, 255];
    };
    const out: { text: string; fg: number[]; bg: number[] }[] = [];
    const walker = document.createTreeWalker(document.querySelector("body > table")!, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text || text === "|") continue;
      const el = n.parentElement!;
      out.push({ text, fg: parse(getComputedStyle(el).color)!, bg: bgOf(el) });
    }
    return out;
  });
}

const CASES = [
  ...STARTERS.map((s) => ({ name: s.key, html: renderSignature(s.doc, { brand: BRAND, person: PERSON, assets: {}, origin: ORIGIN }).html })),
  { name: "html-mode", html: renderHtmlSignature(HTML_STARTER, { brand: BRAND, person: PERSON }).html },
];

const VIEWS = [
  { label: "desktop", width: 640 },
  { label: "phone", width: 375 },
];

for (const c of CASES) {
  test(c.name, async ({ page }, info) => {
    await serveImages(page);
    for (const dark of [false, true]) {
      for (const view of VIEWS) {
        const where = `${view.label}, ${dark ? "dark" : "light"}`;
        await page.setViewportSize({ width: view.width, height: 800 });
        await page.setContent(frameDoc(c.html, dark), { waitUntil: "load" });

        const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src")));
        expect(broken, `images that didn't load (${where})`).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `runs off the side (${where})`).toBeLessThanOrEqual(0);

        for (const t of await textColours(page)) {
          expect(ratio(t.fg, t.bg), `"${t.text}" is hard to read (${where})`).toBeGreaterThanOrEqual(3);
        }

        const shot = await page.locator("body").screenshot();
        await info.attach(`${view.label}-${dark ? "dark" : "light"}.png`, { body: shot, contentType: "image/png" });
      }
    }
  });
}

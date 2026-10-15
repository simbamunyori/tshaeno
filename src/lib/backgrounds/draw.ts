/**
 * Draws a 1920 by 1080 meeting background on a canvas, in the browser,
 * where the person's own fonts are. Used by the free tool on the website,
 * the console and each person's own page.
 */

export const W = 1920;
export const H = 1080;

export type Style = "panel" | "light" | "band" | "photo";

export const STYLES: { key: Style; label: string }[] = [
  { key: "panel", label: "Deep colour" },
  { key: "light", label: "Light office" },
  { key: "band", label: "Brand band" },
];

export const PHOTO_STYLE = { key: "photo" as const, label: "Your own picture" };

export interface BackgroundInput {
  style: Style;
  colour: string;
  name: string;
  title: string;
  company: string;
  logo: HTMLImageElement | null;
  /** The company's own picture, for the photo style. */
  photo?: HTMLImageElement | null;
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c * amount : (255 - c) * amount))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}

export function draw(ctx: CanvasRenderingContext2D, o: BackgroundInput) {
  const { style, colour } = o;
  const dark = style !== "light";
  ctx.clearRect(0, 0, W, H);

  if (style === "photo" && o.photo) {
    const s = Math.max(W / o.photo.naturalWidth, H / o.photo.naturalHeight);
    const pw = o.photo.naturalWidth * s;
    const ph = o.photo.naturalHeight * s;
    ctx.drawImage(o.photo, (W - pw) / 2, (H - ph) / 2, pw, ph);
    // A soft shade at the bottom so the name reads on any picture.
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, "rgba(10,13,20,0)");
    g.addColorStop(1, "rgba(10,13,20,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (style === "light") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#f7f5f1");
    g.addColorStop(1, "#e9e4da");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Soft architectural shapes, like a bright office wall.
    ctx.fillStyle = shade(colour, 0.88);
    ctx.fillRect(W - 520, 0, 520, H);
    ctx.fillStyle = shade(colour, 0.8);
    ctx.fillRect(W - 520, 0, 14, H);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(140, 120, 420, 640);
    ctx.globalAlpha = 1;
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, shade(colour, -0.25));
    g.addColorStop(1, shade(colour, 0.12));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 3;
    for (const r of [420, 560, 700]) {
      ctx.beginPath();
      ctx.arc(W - 200, 160, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (style === "band") {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, H - 300, W, 300);
      ctx.fillStyle = "#e3c893";
      ctx.fillRect(0, H - 300, W, 4);
    }
  }

  // The logo sits top right, away from the person in the middle.
  if (o.logo) {
    const maxW = 340;
    const maxH = 130;
    const s = Math.min(maxW / o.logo.naturalWidth, maxH / o.logo.naturalHeight);
    const lw = o.logo.naturalWidth * s;
    const lh = o.logo.naturalHeight * s;
    const x = W - 80 - lw;
    const y = 80;
    if (dark) {
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      roundRect(ctx, x - 28, y - 22, lw + 56, lh + 44, 16);
      ctx.fill();
    }
    ctx.drawImage(o.logo, x, y, lw, lh);
  } else if (o.company) {
    ctx.fillStyle = dark ? "#ffffff" : colour;
    ctx.font = "italic 64px Georgia, 'Times New Roman', serif";
    ctx.textAlign = "right";
    ctx.fillText(o.company, W - 90, 150);
  }

  // Name and title bottom left, where meeting apps leave room.
  ctx.textAlign = "left";
  const baseY = style === "band" ? H - 150 : H - 170;
  ctx.fillStyle = dark ? "#ffffff" : "#11182b";
  ctx.font = "600 64px 'Instrument Sans Variable', 'Segoe UI', Arial, sans-serif";
  if (o.name) ctx.fillText(o.name, 100, baseY);
  ctx.fillStyle = dark ? "rgba(255,255,255,0.75)" : "#5b6070";
  ctx.font = "400 38px 'Instrument Sans Variable', 'Segoe UI', Arial, sans-serif";
  const line = [o.title, o.logo ? o.company : ""].filter(Boolean).join("  ·  ");
  if (line) ctx.fillText(line, 102, baseY + 62);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}


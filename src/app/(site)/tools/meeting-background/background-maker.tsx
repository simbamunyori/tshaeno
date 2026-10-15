"use client";

import { Download, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PALETTES, safeColour } from "@/lib/site/samples";

const W = 1920;
const H = 1080;

type Style = "panel" | "light" | "band";

const STYLES: { key: Style; label: string }[] = [
  { key: "panel", label: "Deep colour" },
  { key: "light", label: "Light office" },
  { key: "band", label: "Brand band" },
];

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c * amount : (255 - c) * amount))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}

function draw(ctx: CanvasRenderingContext2D, o: { style: Style; colour: string; name: string; title: string; company: string; logo: HTMLImageElement | null }) {
  const { style, colour } = o;
  const dark = style !== "light";
  ctx.clearRect(0, 0, W, H);

  if (style === "light") {
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

/** Makes a 1920 by 1080 meeting background in the browser. Nothing is uploaded. */
export function BackgroundMaker() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [style, setStyle] = useState<Style>("panel");
  const [colour, setColour] = useState(PALETTES[0].primary);
  const [name, setName] = useState("Lerato Nkwe");
  const [title, setTitle] = useState("Engagement Manager");
  const [company, setCompany] = useState("Meridian Advisory");
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const run = () => draw(ctx, { style, colour: safeColour(colour, PALETTES[0].primary), name, title, company, logo });
    run();
    // Draw again once the page font is ready, so the name uses it.
    document.fonts?.ready.then(run).catch(() => {});
  }, [style, colour, name, title, company, logo]);

  const field = "h-10 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-body text-ink";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        <canvas ref={canvas} width={W} height={H} className="aspect-video w-full rounded-xl border border-border bg-surface-2 shadow-elevation-2" aria-label="Your meeting background" role="img" />
        <p className="text-callout text-ink-muted">Your camera covers the middle, so the logo and your name sit where people can still see them. Everything stays on your computer.</p>
      </div>
      <form className="flex flex-col gap-4 self-start rounded-xl border border-border bg-surface-1 p-5 sm:p-6" onSubmit={(e) => e.preventDefault()} aria-label="Background details">
        <div className="flex flex-col gap-1.5">
          <span className="text-callout font-semibold text-ink">Your logo</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => file.current?.click()} className="flex h-12 flex-1 items-center gap-3 rounded-md border border-dashed border-border-strong bg-surface-0 px-3 text-left text-callout text-ink hover:border-ink">
              <ImagePlus aria-hidden className="size-5 text-ink-muted" />
              {logo ? "Change logo" : "Upload a PNG or JPEG"}
            </button>
            {logo ? (
              <button type="button" onClick={() => setLogo(null)} aria-label="Remove logo" className="flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2">
                <X aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Logo file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 4 * 1024 * 1024) return setError("Choose an image under 4 MB.");
              const img = new Image();
              img.onload = () => {
                setLogo(img);
                setError("");
              };
              img.onerror = () => setError("That image couldn't be read.");
              img.src = URL.createObjectURL(f);
            }}
          />
          {error ? <p className="text-callout text-negative">{error}</p> : null}
        </div>
        <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
          Your name
          <input className={field} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
          Your title
          <input className={field} value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
          Company
          <input className={field} value={company} maxLength={40} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">Style</legend>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={style === s.key}
                onClick={() => setStyle(s.key)}
                className={cn("h-9 rounded-full border px-3.5 text-callout", style === s.key ? "border-brand bg-brand text-on-brand" : "border-border bg-surface-1 text-ink")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">Brand colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-label={p.name}
                title={p.name}
                aria-pressed={colour === p.primary}
                onClick={() => setColour(p.primary)}
                className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface-1", colour === p.primary ? "ring-2 ring-ink" : "")}
                style={{ background: p.primary }}
              />
            ))}
            <input type="color" aria-label="Your own colour" value={safeColour(colour, PALETTES[0].primary)} onChange={(e) => setColour(e.target.value)} className="size-8 cursor-pointer rounded border border-border bg-transparent" />
          </div>
        </fieldset>
        <Button
          type="button"
          size="lg"
          className="mt-2"
          onClick={() =>
            canvas.current?.toBlob((b) => {
              if (!b) return;
              const a = document.createElement("a");
              a.href = URL.createObjectURL(b);
              a.download = `${(name || "meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-background.png`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            }, "image/png")
          }
        >
          <Download aria-hidden /> Download, 1920 by 1080
        </Button>
      </form>
    </div>
  );
}

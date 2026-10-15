"use client";

import { Download, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { draw, H, STYLES, W, type Style } from "@/lib/backgrounds/draw";
import { PALETTES, safeColour } from "@/lib/site/samples";

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

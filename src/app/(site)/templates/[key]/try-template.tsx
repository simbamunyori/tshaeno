"use client";

import { ImagePlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PreviewToggles, SignatureFrame, type PreviewMode } from "@/components/signatures/preview";
import { buttonVariants } from "@/components/ui/button";
import { FREE_PEOPLE } from "@/lib/billing/plans";
import { cn } from "@/lib/cn";
import type { ImageRef, SignatureDoc } from "@/lib/signature/types";
import { previewHtml } from "@/lib/site/preview";
import { type Palette, safeColour, sampleCompany } from "@/lib/site/samples";

const MAX_BYTES = 4 * 1024 * 1024;

/** Reads an image the visitor picked into a data URL with its real size. It never leaves the browser. */
function readImage(file: File): Promise<ImageRef> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return reject(new Error("Choose a PNG, JPEG, GIF or WebP image. Email apps don't show SVG."));
    if (file.size > MAX_BYTES) return reject(new Error("Choose an image under 4 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image couldn't be read."));
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => resolve({ url, width: img.naturalWidth || 400, height: img.naturalHeight || 100 });
      img.onerror = () => reject(new Error("That image couldn't be read."));
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
}

function ImageField({ label, hint, value, onChange, onError }: { label: string; hint: string; value: ImageRef | null; onChange: (v: ImageRef | null) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-callout font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-md border border-dashed border-border-strong bg-surface-0 px-3 text-left text-callout text-ink hover:border-ink"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt="" className="h-9 max-w-[120px] object-contain" />
          ) : (
            <ImagePlus aria-hidden className="size-5 shrink-0 text-ink-muted" />
          )}
          <span className="truncate">{value ? "Change" : hint}</span>
        </button>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`Remove ${label.toLowerCase()}`}>
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            onChange(await readImage(f));
            onError("");
          } catch (err) {
            onError((err as Error).message);
          }
        }}
      />
    </div>
  );
}

/**
 * The template with the visitor's own logo, photo, graphic, name and
 * colour, before they sign up. Nothing chosen here leaves the browser.
 */
export function TryTemplate({
  doc,
  templateKey,
  industry,
  showsGraphic,
  origin,
  palettes,
  initialPalette,
}: {
  doc: SignatureDoc;
  templateKey: string;
  industry: string;
  showsGraphic: boolean;
  origin: string;
  palettes: Palette[];
  initialPalette: string;
}) {
  const [mode, setMode] = useState<PreviewMode>({ dark: false, phone: false });
  const [pal, setPal] = useState(() => palettes.find((p) => p.key === initialPalette) ?? palettes[0]);
  const [colour, setColour] = useState(pal.primary);
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [logo, setLogo] = useState<ImageRef | null>(null);
  const [photo, setPhoto] = useState<ImageRef | null>(null);
  const [graphic, setGraphic] = useState<ImageRef | null>(null);
  const [error, setError] = useState("");
  const sample = sampleCompany(industry);

  const html = useMemo(
    () =>
      previewHtml(doc, pal, origin, {
        industry,
        company,
        name,
        title,
        primary: safeColour(colour, pal.primary),
        logo,
        photo,
        graphic: graphic ?? (showsGraphic ? "sample" : null),
      }),
    [doc, pal, colour, company, name, title, origin, industry, logo, photo, graphic, showsGraphic],
  );

  const field = "h-10 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-body text-ink placeholder:text-ink-muted/70";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <PreviewToggles mode={mode} onChange={setMode} />
        <div className={cn("rounded-lg p-3 sm:p-6", mode.dark ? "bg-[#1f1f1f]" : "bg-surface-2")}>
          <SignatureFrame html={html} mode={mode} title="Template preview" className="mx-auto bg-white" />
        </div>
        <p className="text-callout text-ink-muted">
          {logo ? "That's your logo." : `${sample.full} is a made-up company. Add your own logo to see the real thing.`} Pictures you add here stay on your computer
          until you sign up.
        </p>
      </div>

      <form className="flex flex-col gap-4 self-start rounded-lg border border-border bg-surface-1 p-5 sm:p-6" onSubmit={(e) => e.preventDefault()} aria-label="Make it yours">
        <h2 className="font-display text-[28px] leading-8 text-ink">Make it yours</h2>
        <ImageField label="Your logo" hint="A PNG with a clear background works best" value={logo} onChange={setLogo} onError={setError} />
        <ImageField label="Your photo" hint="A head and shoulders shot works best" value={photo} onChange={setPhoto} onError={setError} />
        <ImageField label="Your own graphic" hint="A banner, award or event poster" value={graphic} onChange={setGraphic} onError={setError} />
        {error ? (
          <p role="alert" className="text-callout text-negative">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
          Company
          <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder={sample.full} maxLength={40} autoComplete="organization" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
            Your name
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={sample.person.name} maxLength={60} autoComplete="name" />
          </label>
          <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
            Your title
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={sample.person.title} maxLength={60} autoComplete="organization-title" />
          </label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">Brand colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {palettes.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-label={p.name}
                title={p.name}
                aria-pressed={pal.key === p.key && colour === p.primary}
                onClick={() => {
                  setPal(p);
                  setColour(p.primary);
                }}
                className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface-1", pal.key === p.key && colour === p.primary ? "ring-2 ring-ink" : "")}
                style={{ background: p.primary }}
              />
            ))}
            <label className="ml-1 flex items-center gap-2 text-callout text-ink-muted">
              <input type="color" value={safeColour(colour, pal.primary)} onChange={(e) => setColour(e.target.value)} className="size-8 cursor-pointer rounded border border-border bg-transparent" />
              Your own
            </label>
          </div>
        </fieldset>
        <a href={`/templates/${templateKey}/use`} className={cn(buttonVariants({ size: "lg" }), "mt-2 w-full")}>
          Use this template
        </a>
        <p className="text-caption text-ink-muted">Free for teams of up to {FREE_PEOPLE}. You&apos;ll upload your logo once, in your brand kit, and every signature uses it.</p>
      </form>
    </div>
  );
}

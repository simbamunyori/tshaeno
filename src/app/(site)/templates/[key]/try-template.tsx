"use client";

import { useMemo, useState } from "react";
import { PreviewToggles, SignatureFrame, type PreviewMode } from "@/components/signatures/preview";
import { buttonVariants } from "@/components/ui/button";
import { FREE_PEOPLE } from "@/lib/billing/plans";
import { cn } from "@/lib/cn";
import { renderSignature } from "@/lib/signature/render";
import type { SignatureDoc } from "@/lib/signature/types";
import { type Palette, SAMPLE_COMPANY, safeColour, sampleBrand, samplePerson } from "@/lib/site/samples";

/** The template with the visitor's own name, company and colour, before they sign up. Nothing typed here leaves the browser. */
export function TryTemplate({ doc, templateKey, origin, palettes, initialPalette }: { doc: SignatureDoc; templateKey: string; origin: string; palettes: Palette[]; initialPalette: string }) {
  const [mode, setMode] = useState<PreviewMode>({ dark: false, phone: false });
  const [pal, setPal] = useState(() => palettes.find((p) => p.key === initialPalette) ?? palettes[0]);
  const [colour, setColour] = useState(pal.primary);
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");

  const html = useMemo(() => {
    const input = { company, name, title, primary: safeColour(colour, pal.primary) };
    return renderSignature(doc, { brand: sampleBrand(pal, input), person: samplePerson(pal, input), assets: {}, origin }).html;
  }, [doc, pal, colour, company, name, title, origin]);

  const field = "h-10 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-body text-ink placeholder:text-ink-muted/70";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <PreviewToggles mode={mode} onChange={setMode} />
        <div className={cn("rounded-lg p-3 sm:p-5", mode.dark ? "bg-[#1f1f1f]" : "bg-surface-2")}>
          <SignatureFrame html={html} mode={mode} title="Template preview" className="mx-auto bg-white" />
        </div>
        <p className="text-caption text-ink-muted">The logo and photo are stand-ins. Yours come from your brand kit and directory.</p>
      </div>

      <form className="flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5" onSubmit={(e) => e.preventDefault()} aria-label="Try it with your details">
        <h2 className="text-headline text-ink">Try it with your details</h2>
        <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
          Company
          <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder={SAMPLE_COMPANY} maxLength={40} autoComplete="organization" />
        </label>
        <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
          Your name
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lesedi Molefe" maxLength={60} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
          Your title
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Head of Operations" maxLength={60} autoComplete="organization-title" />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">Brand colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {palettes.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-label={p.name}
                aria-pressed={pal.key === p.key && colour === p.primary}
                onClick={() => {
                  setPal(p);
                  setColour(p.primary);
                }}
                className={cn("size-8 rounded-full border-2", pal.key === p.key && colour === p.primary ? "border-ink" : "border-transparent")}
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
          Use this template free
        </a>
        <p className="text-caption text-ink-muted">You&apos;ll create an account, then add your real logo and colours. Free for up to {FREE_PEOPLE} people.</p>
      </form>
    </div>
  );
}

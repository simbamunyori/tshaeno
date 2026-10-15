"use client";

import { useActionState, useMemo, useState } from "react";
import { BackgroundCanvas, type CanvasDesign } from "@/components/backgrounds/background-canvas";
import type { FormState } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PHOTO_STYLE, STYLES, type Style } from "@/lib/backgrounds/draw";
import { cn } from "@/lib/cn";
import { saveBackgroundAction } from "./actions";

export interface KitOption {
  id: string;
  name: string;
  company: string;
  logoUrl: string | null;
  colours: string[];
}

const field = "h-10 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-body text-ink";
const label = "flex flex-col gap-1.5 text-callout font-semibold text-ink";

/** Designs a meeting background, with a live preview using a real person's name. */
export function BackgroundEditor({
  initial,
  kits,
  sample,
}: {
  initial: { id: string | null; name: string; style: Style; colour: string; brandKitId: string | null; photoUrl: string | null; showName: boolean; showTitle: boolean; published: boolean };
  kits: KitOption[];
  sample: { name: string; title: string };
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveBackgroundAction, {});
  const [name, setName] = useState(initial.name);
  const [style, setStyle] = useState<Style>(initial.style);
  const [kitId, setKitId] = useState(initial.brandKitId ?? "");
  const kit = kits.find((k) => k.id === kitId) ?? kits[0];
  const [colour, setColour] = useState(initial.colour);
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [showName, setShowName] = useState(initial.showName);
  const [showTitle, setShowTitle] = useState(initial.showTitle);
  const [published, setPublished] = useState(initial.published);

  const design: CanvasDesign = useMemo(
    () => ({ style, colour, company: kit?.company ?? "", logoUrl: kit?.logoUrl ?? null, photoUrl, showName, showTitle }),
    [style, colour, kit, photoUrl, showName, showTitle],
  );
  const swatches = [...new Set([...(kit?.colours ?? []), "#14213D", "#2A2E35"].map((c) => c.toUpperCase()))].slice(0, 6);

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        <BackgroundCanvas design={design} name={sample.name} title={sample.title} />
        <p className="text-callout text-ink-muted">
          Shown with {sample.name}&apos;s details. Everyone gets their own copy with their name and title, ready to download from their own page.
          {kit && !kit.logoUrl ? " Add a logo to the brand kit to show it here." : ""}
        </p>
      </div>
      <form action={run} className="flex flex-col gap-4 self-start rounded-xl border border-border bg-surface-1 p-5" encType="multipart/form-data">
        {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
        {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
        <label className={label}>
          Name
          <input name="name" className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        </label>
        {kits.length > 1 ? (
          <label className={label}>
            Brand kit
            <select name="brandKitId" className={field} value={kitId} onChange={(e) => setKitId(e.target.value)}>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="brandKitId" value={kitId} />
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">Style</legend>
          <input type="hidden" name="style" value={style} />
          <div className="flex flex-wrap gap-2">
            {[...STYLES, PHOTO_STYLE].map((s) => (
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
        {style === "photo" ? (
          <label className={label}>
            Picture
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="text-callout font-normal text-ink"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoUrl(URL.createObjectURL(f));
              }}
            />
            <span className="font-normal text-ink-muted">A wide picture of your office or work, at least 1920 pixels across. Keep the middle calm: people sit in front of it.</span>
          </label>
        ) : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">Colour</legend>
          <input type="hidden" name="colour" value={colour} />
          <div className="flex flex-wrap items-center gap-2">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={colour.toUpperCase() === c}
                onClick={() => setColour(c)}
                className={cn("size-8 rounded-full border border-border ring-offset-2 ring-offset-surface-1", colour.toUpperCase() === c ? "ring-2 ring-ink" : "")}
                style={{ background: c }}
              />
            ))}
            <input type="color" aria-label="Another colour" value={colour} onChange={(e) => setColour(e.target.value)} className="size-8 cursor-pointer rounded border border-border bg-transparent" />
          </div>
        </fieldset>
        <div className="flex flex-col gap-2 text-callout text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="showName" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Show each person&apos;s name
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="showTitle" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Show their job title
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Offer it to everyone on their own page
          </label>
        </div>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : initial.id ? "Save changes" : "Create background"}
        </Button>
      </form>
    </div>
  );
}

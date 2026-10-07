"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { selectClass, selectStyle } from "@/components/ui/inputs";
import { PreviewToggles, SignatureFrame, type PreviewMode } from "@/components/signatures/preview";
import { cn } from "@/lib/cn";
import { SAMPLE_PERSON } from "@/lib/signature/fields";
import { renderSignature, SOCIAL_LABEL } from "@/lib/signature/render";
import { starter } from "@/lib/signature/starters";
import { FONT_KEYS, FONTS, isHex } from "@/lib/signature/style";
import type { BrandColours, FontKey, ImageRef, SocialNetwork } from "@/lib/signature/types";
import type { BrandKitData } from "@/server/signatures/brand";
import { logoAction, saveKitAction, type BrandState } from "../actions";

const NETWORKS = Object.keys(SOCIAL_LABEL) as SocialNetwork[];
const COLOUR_LABEL: Record<keyof BrandColours, { label: string; hint: string }> = {
  primary: { label: "Primary", hint: "Icons, buttons and accents" },
  secondary: { label: "Secondary", hint: "Dividers and rules" },
  text: { label: "Text", hint: "Names and details" },
  muted: { label: "Muted", hint: "Titles and small print" },
};

export function KitEditor({ id, name: initialName, data, logo: initialLogo, origin, readOnly }: { id: string; name: string; data: BrandKitData; logo: ImageRef | null; origin: string; readOnly: boolean }) {
  const [name, setName] = React.useState(initialName);
  const [d, setD] = React.useState<BrandKitData>(data);
  const [logo, setLogo] = React.useState(initialLogo);
  const [state, setState] = React.useState<BrandState>({});
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [mode, setMode] = React.useState<PreviewMode>({ dark: false, phone: false });
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setLogo(initialLogo), [initialLogo]);

  const sample = React.useMemo(() => starter("general-everyday")!.doc, []);
  const html = React.useMemo(
    () => renderSignature(sample, { brand: { ...d, logo }, person: SAMPLE_PERSON, assets: {}, origin }).html,
    [sample, d, logo, origin],
  );

  const set = <K extends keyof BrandKitData>(k: K, v: BrandKitData[K]) => setD((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    setState(await saveKitAction(id, { name, data: d }));
    setSaving(false);
  };
  const uploadLogo = async (remove: boolean) => {
    const fd = new FormData();
    fd.set("id", id);
    if (remove) fd.set("remove", "1");
    else {
      const f = fileRef.current?.files?.[0];
      if (!f) return;
      fd.set("file", f);
    }
    setUploading(true);
    const r = await logoAction(fd);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    setState(r);
    if (remove && !r.error) setLogo(null);
  };
  const err = (field: string) => (state.field && state.field.startsWith(field) ? state.error : undefined);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Name and logo" />
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="kit-name" className="text-callout font-semibold text-ink">
                Kit name
              </label>
              <input id="kit-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-callout font-semibold text-ink">Logo</span>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-40 items-center justify-center rounded-md border border-border bg-white p-2">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.url} alt="Current logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-caption text-ink-muted">No logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif" aria-label="Logo file" className="text-callout text-ink" onChange={() => uploadLogo(false)} />
                  {logo ? (
                    <button type="button" onClick={() => uploadLogo(true)} className="self-start text-callout font-semibold text-negative hover:underline">
                      Remove logo
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-caption text-ink-muted">
                {uploading ? "Uploading…" : "PNG with a transparent background works best, at least 300 pixels wide. Mail clients don't show SVG."}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Colours and font" />
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(COLOUR_LABEL) as (keyof BrandColours)[]).map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <label htmlFor={`c-${k}`} className="text-callout font-semibold text-ink">
                  {COLOUR_LABEL[k].label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${COLOUR_LABEL[k].label} colour picker`}
                    value={isHex(d.colours[k]) ? d.colours[k].toLowerCase() : "#000000"}
                    onChange={(e) => set("colours", { ...d.colours, [k]: e.target.value.toUpperCase() })}
                    className="size-11 shrink-0 cursor-pointer rounded-md border border-border-strong bg-transparent p-1"
                  />
                  <input id={`c-${k}`} value={d.colours[k]} onChange={(e) => set("colours", { ...d.colours, [k]: e.target.value })} className={inputClass} />
                </div>
                <p className="text-caption text-ink-muted">{COLOUR_LABEL[k].hint}</p>
              </div>
            ))}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="font" className="text-callout font-semibold text-ink">
                Font
              </label>
              <select id="font" value={d.font} onChange={(e) => set("font", e.target.value as FontKey)} className={cn(inputClass, selectClass)} style={selectStyle}>
                {FONT_KEYS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: FONTS[f].stack }}>
                    {FONTS[f].label}
                  </option>
                ))}
              </select>
              <p className="text-caption text-ink-muted">Only fonts every mail client has. Custom web fonts don&apos;t load in signatures.</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Company details">Used as {"{{company}}"}, {"{{website}}"} and {"{{address}}"}.</CardHeader>
          <div className="flex flex-col gap-4">
            {(["company", "website", "address"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <label htmlFor={`f-${k}`} className="text-callout font-semibold text-ink">
                  {k === "company" ? "Company name" : k === "website" ? "Website" : "Address"}
                </label>
                <input id={`f-${k}`} value={d[k]} maxLength={200} onChange={(e) => set(k, e.target.value)} aria-invalid={!!err(k) || undefined} className={inputClass} />
                {err(k) ? <p className="text-callout text-negative">{err(k)}</p> : null}
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-disclaimer" className="text-callout font-semibold text-ink">
                Disclaimer
              </label>
              <textarea id="f-disclaimer" rows={4} value={d.disclaimer} maxLength={1500} onChange={(e) => set("disclaimer", e.target.value)} className={cn(inputClass, "h-auto py-2")} />
              <p className="text-caption text-ink-muted">Shown wherever a signature has a disclaimer block. Fields such as {"{{company}}"} work here too.</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Social links" />
          <ul className="flex flex-col gap-3">
            {d.socials.map((s, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2">
                <select
                  aria-label="Network"
                  value={s.network}
                  onChange={(e) => set("socials", d.socials.map((x, j) => (j === i ? { ...x, network: e.target.value as SocialNetwork } : x)))}
                  className={cn(inputClass, selectClass, "w-40")}
                  style={selectStyle}
                >
                  {NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {SOCIAL_LABEL[n]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`${SOCIAL_LABEL[s.network]} link`}
                  value={s.url}
                  placeholder="https://"
                  onChange={(e) => set("socials", d.socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  className={cn(inputClass, "min-w-0 flex-1")}
                />
                <Button variant="ghost" aria-label="Remove link" onClick={() => set("socials", d.socials.filter((_, j) => j !== i))} className="h-11 text-negative">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          {err("socials") ? <p className="mt-2 text-callout text-negative">{err("socials")}</p> : null}
          {d.socials.length < NETWORKS.length ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => set("socials", [...d.socials, { network: NETWORKS.find((n) => !d.socials.some((s) => s.network === n)) ?? "linkedin", url: "" }])}
            >
              <Plus /> Add a link
            </Button>
          ) : null}
        </Card>
      </fieldset>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-headline text-ink">Preview</h2>
        <PreviewToggles mode={mode} onChange={setMode} />
        <div className={cn("rounded-lg p-3", mode.dark ? "bg-[#111]" : "bg-surface-2")}>
          <SignatureFrame html={html} mode={mode} />
        </div>
        {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
        {readOnly ? null : (
          <div>
            <Button onClick={save} disabled={saving} size="lg">
              {saving ? "Saving…" : "Save brand kit"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

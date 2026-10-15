"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { CopyBox } from "@/components/site/copy-box";
import { cn } from "@/lib/cn";
import { COUNTRIES, DISCLAIMER_PARTS, type DisclaimerInput, type DisclaimerPart, disclaimer } from "@/lib/site/writers";

const field = "h-10 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-body text-ink placeholder:text-ink-muted/70";
const label = "flex flex-col gap-1.5 text-callout font-semibold text-ink";

/** Builds a short email disclaimer from the parts a business picks. Nothing is sent anywhere. */
export function DisclaimerWriter() {
  const [v, setV] = useState<DisclaimerInput>({ company: "", registration: "", country: "BW", parts: ["confidential", "contract", "privacy"], licence: "" });
  const set = <K extends keyof DisclaimerInput>(k: K, value: DisclaimerInput[K]) => setV((o) => ({ ...o, [k]: value }));
  const toggle = (p: DisclaimerPart) => set("parts", v.parts.includes(p) ? v.parts.filter((x) => x !== p) : [...v.parts, p]);
  const text = disclaimer({ ...v, company: v.company || "Northgate & Company (Pty) Ltd" });

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form className="flex flex-col gap-4 self-start rounded-lg border border-border bg-surface-1 p-5 sm:p-6" onSubmit={(e) => e.preventDefault()} aria-label="Your business">
        <label className={label}>
          Registered company name
          <input className={field} value={v.company} onChange={(e) => set("company", e.target.value)} placeholder="Northgate & Company (Pty) Ltd" maxLength={80} autoComplete="organization" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className={label}>
            Registered in
            <select className={field} value={v.country} onChange={(e) => set("country", e.target.value as DisclaimerInput["country"])}>
              {COUNTRIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Company number
            <input className={field} value={v.registration} onChange={(e) => set("registration", e.target.value)} placeholder="Optional" maxLength={40} />
          </label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">What to include</legend>
          {DISCLAIMER_PARTS.map((p) => {
            const on = v.parts.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(p.key)}
                className={cn("flex items-start gap-3 rounded-md border p-3 text-left", on ? "border-ink bg-surface-0" : "border-border hover:border-border-strong")}
              >
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-ink bg-ink text-surface-1" : "border-border-strong")}>
                  {on ? <Check aria-hidden className="size-3.5" /> : null}
                </span>
                <span className="flex flex-col">
                  <span className="text-callout font-semibold text-ink">{p.label}</span>
                  <span className="text-caption text-ink-muted">{p.hint}</span>
                </span>
              </button>
            );
          })}
        </fieldset>
        {v.parts.includes("regulated") ? (
          <label className={label}>
            Licence or registration line
            <input className={field} value={v.licence} onChange={(e) => set("licence", e.target.value)} placeholder="An authorised financial services provider, FSP 12345" maxLength={120} />
          </label>
        ) : null}
      </form>
      <div className="flex min-w-0 flex-col gap-4">
        <CopyBox text={text || "Choose at least one part."} label="Your disclaimer" />
        <p className="text-callout text-ink-muted">
          This is a sensible starting point, not legal advice. If your business is regulated, ask whoever handles your compliance to check the wording before you use it. In Tshaeno, you set it once and it appears under every external email.
        </p>
      </div>
    </div>
  );
}

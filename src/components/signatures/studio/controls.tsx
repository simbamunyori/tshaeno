"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/field";
import { selectClass, selectStyle } from "@/components/ui/inputs";
import type { BrandColours, ColourRef } from "@/lib/signature/types";
import { isHex, normaliseHex } from "@/lib/signature/style";

/** Small, dense controls for the studio's settings panel. */

export const smallInput = cn(inputClass, "h-9 text-callout");

export function Row({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-callout font-semibold text-ink">
          {label}
        </label>
      ) : (
        <span className="text-callout font-semibold text-ink">{label}</span>
      )}
      {children}
      {hint ? <p className="text-caption text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex flex-wrap rounded-lg bg-surface-2 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-8 min-w-9 flex-1 items-center justify-center gap-1 rounded-md px-2 text-callout",
              value === o.value ? "bg-surface-1 font-semibold text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Row>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-callout text-ink">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--brand)]" />
      {label}
    </label>
  );
}

export function Slider({ label, value, min, max, step = 1, unit = "px", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const id = React.useId();
  return (
    <Row label={label} htmlFor={id}>
      <div className="flex items-center gap-3">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--brand)]" />
        <span className="w-14 text-right text-callout tabular-nums text-ink-muted">
          {value}
          {unit}
        </span>
      </div>
    </Row>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = React.useId();
  return (
    <Row label={label} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(smallInput, selectClass)} style={selectStyle}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

const ROLES: { ref: Exclude<ColourRef, `#${string}`>; label: string }[] = [
  { ref: "primary", label: "Primary" },
  { ref: "secondary", label: "Secondary" },
  { ref: "text", label: "Text" },
  { ref: "muted", label: "Muted" },
];

/** Brand colours by role, so a signature follows its kit, or any other colour. */
export function ColourPicker({ label, value, colours, onChange }: { label: string; value: ColourRef; colours: BrandColours; onChange: (v: ColourRef) => void }) {
  const custom = value.startsWith("#");
  const [draft, setDraft] = React.useState<string>(custom ? value : "#");
  React.useEffect(() => {
    if (value.startsWith("#")) setDraft(value);
  }, [value]);
  return (
    <Row label={label}>
      <div className="flex flex-wrap items-center gap-2">
        {ROLES.map((r) => (
          <button
            key={r.ref}
            type="button"
            title={`${r.label} (${colours[r.ref]})`}
            aria-label={`${r.label} brand colour`}
            aria-pressed={value === r.ref}
            onClick={() => onChange(r.ref)}
            className={cn("size-8 rounded-full border border-border-strong", value === r.ref && "ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface-1)]")}
            style={{ background: colours[r.ref] }}
          />
        ))}
        <input
          type="color"
          aria-label="Other colour"
          value={custom ? normaliseHex(value) : "#000000"}
          onChange={(e) => onChange(e.target.value as ColourRef)}
          className={cn("size-8 cursor-pointer rounded-full border border-border-strong bg-transparent p-0", custom && "ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface-1)]")}
        />
        <input
          aria-label="Colour code"
          value={custom ? draft : ""}
          placeholder="#hex"
          onChange={(e) => {
            setDraft(e.target.value);
            if (isHex(e.target.value)) onChange(normaliseHex(e.target.value) as ColourRef);
          }}
          className={cn(smallInput, "w-24")}
        />
      </div>
    </Row>
  );
}

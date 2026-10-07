"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { FIELDS } from "@/lib/signature/fields";
import { smallInput } from "./controls";

/**
 * Full HTML mode: write or paste signature HTML. Anything mail clients
 * would strip, and anything unsafe, is removed when it renders, and the
 * checks beside the preview say what each client will make of the rest.
 */
export function HtmlEditor({ value, onChange, customFields, readOnly }: { value: string; onChange: (v: string) => void; customFields: { key: string; label: string }[]; readOnly: boolean }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const insert = (key: string) => {
    if (!key || !ref.current) return;
    const el = ref.current;
    const token = `{{${key}}}`;
    const start = el.selectionStart;
    onChange(value.slice(0, start) + token + value.slice(el.selectionEnd));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const fields = [...FIELDS.map((f) => ({ key: f.key, label: f.label })), ...customFields.map((f) => ({ key: `custom.${f.key}`, label: f.label }))];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="signature-html" className="text-callout font-semibold text-ink">
          HTML
        </label>
        {readOnly ? null : (
          <select aria-label="Insert a field" value="" onChange={(e) => insert(e.target.value)} className={cn(smallInput, "w-auto")}>
            <option value="">Insert a field…</option>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        id="signature-html"
        ref={ref}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className={cn(smallInput, "h-[440px] resize-y py-3 font-mono text-[12px] leading-5")}
      />
      <p className="text-caption text-ink-muted">
        Use tables and inline styles. Scripts, forms, style tags and unsafe links are removed. Images need full https links; upload them in a visual signature or host them yourself.
      </p>
    </div>
  );
}

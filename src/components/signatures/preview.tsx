"use client";

import { Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { frameDoc } from "@/lib/signature/frame";

/**
 * Shows signature HTML the way a mail client would: in its own frame,
 * with no scripts, on a light or dark background, at desktop or phone
 * width. Dark mode imitates how Outlook and Gmail adjust dark text.
 */

export type PreviewMode = { dark: boolean; phone: boolean };

export function SignatureFrame({ html, mode, className, title = "Signature preview" }: { html: string; mode: PreviewMode; className?: string; title?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(80, Math.ceil(doc.documentElement.scrollHeight)));
  }, []);
  useEffect(() => {
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [html, mode, measure]);
  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-same-origin"
      srcDoc={frameDoc(html, mode.dark)}
      onLoad={measure}
      style={{ height }}
      className={cn("block w-full rounded-md border border-border", mode.phone ? "max-w-[375px]" : "max-w-[640px]", className)}
    />
  );
}

export function PreviewToggles({ mode, onChange }: { mode: PreviewMode; onChange: (m: PreviewMode) => void }) {
  const btn = (active: boolean) =>
    cn("flex h-8 items-center gap-1.5 rounded-md px-2.5 text-callout", active ? "bg-surface-1 font-semibold text-ink shadow-sm" : "text-ink-muted hover:text-ink");
  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex rounded-lg bg-surface-2 p-1" role="group" aria-label="Width">
        <button type="button" className={btn(!mode.phone)} aria-pressed={!mode.phone} onClick={() => onChange({ ...mode, phone: false })}>
          <Monitor aria-hidden className="size-4" /> Desktop
        </button>
        <button type="button" className={btn(mode.phone)} aria-pressed={mode.phone} onClick={() => onChange({ ...mode, phone: true })}>
          <Smartphone aria-hidden className="size-4" /> Phone
        </button>
      </div>
      <div className="flex rounded-lg bg-surface-2 p-1" role="group" aria-label="Appearance">
        <button type="button" className={btn(!mode.dark)} aria-pressed={!mode.dark} onClick={() => onChange({ ...mode, dark: false })}>
          <Sun aria-hidden className="size-4" /> Light
        </button>
        <button type="button" className={btn(mode.dark)} aria-pressed={mode.dark} onClick={() => onChange({ ...mode, dark: true })}>
          <Moon aria-hidden className="size-4" /> Dark
        </button>
      </div>
    </div>
  );
}

"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Generated text with a copy button. */
export function CopyBox({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5 sm:p-6">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold tracking-[0.14em] text-ink-muted uppercase">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard?.writeText(text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </figcaption>
      <p className="text-[15px] leading-7 whitespace-pre-wrap text-ink">{text}</p>
    </figure>
  );
}

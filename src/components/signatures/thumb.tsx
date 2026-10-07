"use client";

import { SignatureFrame } from "./preview";

/** A non-interactive preview for lists and the starter gallery. */
export function SignatureThumb({ html, title }: { html: string; title: string }) {
  return (
    <div className="pointer-events-none overflow-hidden rounded-md bg-surface-2 p-2" aria-hidden>
      <SignatureFrame html={html} mode={{ dark: false, phone: false }} title={title} />
    </div>
  );
}

"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies a signature as rich text, ready to paste into a mail client's settings. */
export function CopyButton({ html, text }: { html: string; text: string }) {
  const [done, setDone] = useState<"copied" | "failed" | null>(null);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
          setDone("copied");
        } catch {
          setDone("failed");
        }
        setTimeout(() => setDone(null), 2500);
      }}
    >
      {done === "copied" ? <Check /> : <ClipboardCopy />}
      {done === "copied" ? "Copied" : done === "failed" ? "Couldn't copy" : "Copy signature"}
    </Button>
  );
}

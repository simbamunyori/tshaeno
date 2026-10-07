"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** A guess at what to call the new passkey, which the person can change later. */
function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Passkey";
}

export function AddPasskey() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const start = await fetch("/api/passkeys/register", { method: "POST" });
      if (!start.ok) throw new Error((await start.json()).error);
      const { challengeId, options } = await start.json();
      const response = await startRegistration({ optionsJSON: options });
      const done = await fetch("/api/passkeys/register", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, response, name: deviceName() }),
      });
      if (!done.ok) throw new Error((await done.json()).error);
      router.refresh();
    } catch (e) {
      // NotAllowedError is the person closing the browser's dialog.
      if (!(e instanceof Error && e.name === "NotAllowedError")) setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={add} disabled={busy}>
        <Plus aria-hidden />
        {busy ? "Waiting for your device…" : "Add a passkey"}
      </Button>
      {error ? <p className="text-callout text-negative">{error}</p> : null}
    </div>
  );
}

"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}

/** Google, Microsoft, Fourth Generation and passkey sign-in. Providers without credentials are left out. */
export function ProviderButtons({
  next,
  providers,
  passkey,
}: {
  next: string;
  providers: { google: boolean; microsoft: boolean; fourthgen?: boolean };
  passkey?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const q = `?next=${encodeURIComponent(next)}`;

  async function signInWithPasskey() {
    setBusy(true);
    try {
      const start = await fetch("/api/passkeys/sign-in", { method: "POST" });
      const { challengeId, options } = await start.json();
      const response = await startAuthentication({ optionsJSON: options });
      const done = await fetch("/api/passkeys/sign-in", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, response }),
      });
      router.push(done.ok ? next : "/sign-in?error=passkey");
      router.refresh();
    } catch {
      // Cancelled in the browser's own dialog: nothing to say.
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.google ? (
        <Button asChild variant="secondary" size="lg" className="w-full">
          <a href={`/auth/google${q}`}>
            <GoogleIcon />
            Continue with Google
          </a>
        </Button>
      ) : null}
      {providers.microsoft ? (
        <Button asChild variant="secondary" size="lg" className="w-full">
          <a href={`/auth/microsoft${q}`}>
            <MicrosoftIcon />
            Continue with Microsoft
          </a>
        </Button>
      ) : null}
      {providers.fourthgen ? (
        <Button asChild variant="secondary" size="lg" className="w-full">
          <a href={`/auth/fourthgen${q}`}>
            <LayoutGrid aria-hidden />
            Continue with Fourth Generation
          </a>
        </Button>
      ) : null}
      {passkey ? (
        <Button variant="secondary" size="lg" className="w-full" onClick={signInWithPasskey} disabled={busy}>
          <KeyRound aria-hidden />
          {busy ? "Waiting for your device…" : "Sign in with a passkey"}
        </Button>
      ) : null}
    </div>
  );
}

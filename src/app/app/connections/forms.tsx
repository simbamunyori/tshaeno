"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { consentLinkAction, connectGoogleAction, type ConnectState } from "./actions";

/** A value to paste somewhere else, with a copy button. */
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-callout font-semibold text-ink">{label}</span>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink">{value}</code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-1"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function GoogleConnectForm({ adminEmail, disabled }: { adminEmail: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectGoogleAction, {});
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert tone="warning">{state.error}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          id="adminEmail"
          label="A super admin's email"
          type="email"
          inputMode="email"
          autoComplete="off"
          defaultValue={adminEmail}
          error={state.fieldErrors?.adminEmail}
          hint="Tshaeno reads the directory as this admin. Nothing is changed in their account."
          className="min-w-64 flex-1"
          disabled={disabled}
        />
        <Button type="submit" disabled={pending || disabled}>
          {pending ? "Checking…" : adminEmail ? "Save and check" : "Connect"}
        </Button>
      </div>
    </form>
  );
}

export function ConsentLinkForm({ disabled, again }: { disabled?: boolean; again?: boolean }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(consentLinkAction, {});
  if (state.link) {
    return (
      <div className="flex flex-col gap-3">
        <CopyValue label="Consent link" value={state.link} />
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href={state.link}>
              Open it now <ExternalLink />
            </a>
          </Button>
          <span className="text-callout text-ink-muted">Or send it to a global admin. It works once.</span>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div>
        <Button type="submit" variant={again ? "secondary" : "primary"} disabled={pending || disabled}>
          {pending ? "Preparing…" : again ? "Grant consent again" : "Get the consent link"}
        </Button>
      </div>
    </form>
  );
}

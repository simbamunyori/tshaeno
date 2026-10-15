"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { CopyValue } from "@/app/app/connections/forms";
import { createPartnerAction, rotateSecretAction, type SecretState } from "./actions";

function ShownOnce({ state }: { state: SecretState }) {
  if (!state.secret) return null;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-4">
      <Alert tone="info">Copy the secret now and pass it to the partner over a secure channel. It isn&apos;t shown again.</Alert>
      {state.keyId ? <CopyValue label="Key" value={state.keyId} /> : null}
      <CopyValue label="Secret" value={state.secret} />
    </div>
  );
}

export function NewPartnerForm() {
  const [state, run, pending] = useActionState<SecretState, FormData>(createPartnerAction, {});
  return (
    <div className="flex flex-col gap-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <ShownOnce state={state} />
      <form action={run} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <TextField id="name" label="Partner's name" placeholder="Fourth Generation Technologies" autoComplete="off" />
        </div>
        <Button type="submit" disabled={pending} className="self-start sm:self-end">
          {pending ? "Adding…" : "Add partner"}
        </Button>
      </form>
    </div>
  );
}

export function RotateSecretForm({ id }: { id: string }) {
  const [state, run, pending] = useActionState<SecretState, FormData>(rotateSecretAction, {});
  return (
    <div className="flex flex-col gap-4">
      <ShownOnce state={state} />
      <form
        action={run}
        onSubmit={(e) => {
          if (!confirm("The current secret stops working at once. Make a new one?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Making…" : "New secret"}
        </Button>
      </form>
    </div>
  );
}

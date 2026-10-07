"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { renameAction, type SettingsState } from "./actions";

export function RenameForm({ name, disabled }: { name: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(renameAction, {});
  return (
    <form action={action} className="flex flex-col gap-4 sm:max-w-[480px]">
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <TextField id="name" label="Name" defaultValue={name} required disabled={disabled} hint={disabled ? "Only owners and admins can change this." : undefined} />
      {disabled ? null : (
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}

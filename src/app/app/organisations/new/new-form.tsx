"use client";

import { useActionState } from "react";
import { createOrganisationAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

export function NewOrganisationForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrganisationAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField id="organisation" label="Name" required defaultValue={state.values?.organisation} error={state.fieldErrors?.organisation} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create organisation"}
      </Button>
    </form>
  );
}

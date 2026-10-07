"use client";

import { useActionState } from "react";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { createOrganisationAction, type FormState } from "../actions";

export function WelcomeForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrganisationAction, {});
  return (
    <form action={action} className="flex flex-col gap-6">
      <AuthHeading title={`Welcome, ${name}`}>
        Name your organisation to get started. If your team already uses Tshaeno, ask an admin to invite you instead.
      </AuthHeading>
      <TextField
        id="organisation"
        label="Organisation name"
        autoComplete="organization"
        required
        defaultValue={state.values?.organisation}
        error={state.fieldErrors?.organisation}
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create organisation"}
      </Button>
    </form>
  );
}

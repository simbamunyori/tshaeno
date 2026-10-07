"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { SelectField, selectClass, selectStyle } from "@/components/ui/inputs";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { changeRoleAction, inviteAction, removeAction, type TeamState } from "./actions";

type Option = { value: string; label: string };

export function InviteForm({ roles }: { roles: Option[] }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(inviteAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-4" noValidate>
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="off" required error={state.fieldErrors?.email} />
        <SelectField id="role" label="Role" options={roles} defaultValue="TEMPLATE_MANAGER" error={state.fieldErrors?.role} />
        <Button type="submit" size="lg" disabled={pending} className={cn(state.fieldErrors ? "sm:mb-7" : "")}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}

export function MemberControls({ id, name, role, roles }: { id: string; name: string; role: string; roles: Option[] }) {
  const [changed, change, changing] = useActionState<TeamState, FormData>(changeRoleAction, {});
  const [removed, remove, removing] = useActionState<TeamState, FormData>(removeAction, {});
  const error = changed.error ?? removed.error;
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <div className="flex items-center gap-3">
        <form action={change}>
          <input type="hidden" name="id" value={id} />
          <label className="sr-only" htmlFor={`role-${id}`}>
            Role for {name}
          </label>
          <select
            id={`role-${id}`}
            name="role"
            defaultValue={role}
            disabled={changing}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={cn(inputClass, selectClass, "h-9 w-[190px] text-callout")}
            style={selectStyle}
          >
            {roles.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </form>
        <form
          action={remove}
          onSubmit={(e) => {
            if (!confirm(`Remove ${name}? They lose access straight away.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button disabled={removing} className="text-callout font-semibold text-negative hover:underline disabled:opacity-60">
            Remove
          </button>
        </form>
      </div>
      {error ? <p className="text-callout text-negative">{error}</p> : null}
    </div>
  );
}

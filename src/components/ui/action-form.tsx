"use client";

import { createContext, useActionState, useContext } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "./alert";
import { Button, type ButtonProps } from "./button";
import { Field, TextField, type TextFieldProps } from "./field";

const Errors = createContext<Record<string, string>>({});

export interface FormState {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * A form posting to a server action, with its message above the fields and
 * one submit button below. Fields inside show their own errors: use
 * ActionTextField from server components, or a children function from
 * client components.
 */
export function ActionForm({
  action,
  children,
  submit,
  pending: pendingLabel,
  variant,
  className,
  encType,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children?: React.ReactNode | ((errors: Record<string, string>) => React.ReactNode);
  submit: string;
  pending?: string;
  variant?: ButtonProps["variant"];
  className?: string;
  encType?: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={run} className={cn("flex flex-col gap-4", className)} encType={encType}>
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <Errors.Provider value={errors}>{typeof children === "function" ? children(errors) : children}</Errors.Provider>
      <Button type="submit" variant={variant} disabled={pending} className="self-start">
        {pending ? (pendingLabel ?? "Saving…") : submit}
      </Button>
    </form>
  );
}

/** A text field that shows the error its form's action returned for it. */
export function ActionTextField(props: Omit<TextFieldProps, "error">) {
  const errors = useContext(Errors);
  return <TextField {...props} error={errors[props.id]} />;
}

/** A file picker that shows the error its form's action returned for it. */
export function ActionFileField({ id, label, hint, accept, name = id }: { id: string; label: string; hint?: string; accept?: string; name?: string }) {
  const error = useContext(Errors)[id];
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(describedBy, invalid) => <input id={id} name={name} type="file" accept={accept} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="text-callout text-ink" />}
    </Field>
  );
}

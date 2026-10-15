"use client";

import { useActionState } from "react";
import type { FormState } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { requestDemoAction } from "./actions";

const SIZES = [
  ["5", "Under 10 people"],
  ["25", "10 to 50"],
  ["100", "50 to 250"],
  ["500", "250 to 1,000"],
  ["2000", "More than 1,000"],
] as const;

export function DemoForm() {
  const [state, run, pending] = useActionState<FormState, FormData>(requestDemoAction, {});
  const errors = state.fieldErrors ?? {};
  if (state.ok) {
    return (
      <div className="flex flex-col gap-3 py-6">
        <h2 className="font-display text-[32px] leading-[38px] text-ink">We&apos;ll be in touch.</h2>
        <p className="text-[16px] leading-7 text-ink-muted">{state.ok}</p>
      </div>
    );
  }
  return (
    <form action={run} className="flex flex-col gap-5">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="name" name="name" label="Your name" autoComplete="name" required maxLength={100} error={errors.name} />
        <TextField id="email" name="email" type="email" label="Work email" autoComplete="email" required maxLength={200} error={errors.email} />
        <TextField id="company" name="company" label="Company" autoComplete="organization" required maxLength={120} error={errors.company} />
        <TextField id="phone" name="phone" type="tel" label="Phone" hint="Optional" autoComplete="tel" maxLength={40} error={errors.phone} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-callout font-semibold text-ink">How many people send email from your company?</legend>
        <div className="flex flex-wrap gap-2">
          {SIZES.map(([value, label], i) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="people" value={value} defaultChecked={i === 1} className="peer sr-only" />
              <span className="flex h-10 items-center rounded-full border border-border bg-surface-1 px-4 text-callout text-ink peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand peer-focus-visible:outline-2 peer-focus-visible:outline-focus">
                {label}
              </span>
            </label>
          ))}
        </div>
        {errors.people ? <p className="text-callout text-negative">{errors.people}</p> : null}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-callout font-semibold text-ink">
        Anything we should know?
        <textarea
          name="message"
          rows={4}
          maxLength={1500}
          placeholder="For example: we use Microsoft 365, have three offices and want a different signature for each."
          className="rounded-md border border-border-strong bg-surface-1 px-3 py-2.5 text-body font-normal text-ink placeholder:text-ink-muted/70"
        />
      </label>
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="self-start px-8">
        {pending ? "Sending…" : "Request a demo"}
      </Button>
      <p className="text-caption text-ink-muted">We use these details to arrange your demo and nothing else.</p>
    </form>
  );
}

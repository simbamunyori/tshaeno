"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthHeading } from "@/components/auth/auth-shell";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { signUpAction, type FormState } from "../actions";

export function SignUpForm({ providers }: { providers: { google: boolean; microsoft: boolean } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const fe = state.fieldErrors ?? {};
  const anyProvider = providers.google || providers.microsoft;
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading eyebrow="Step 1 of 2" title="Create your organisation">
        Set up Tshaeno for your team. You&apos;ll connect Google Workspace or Microsoft 365 after this.
      </AuthHeading>
      {anyProvider ? (
        <>
          <ProviderButtons next="/welcome" providers={providers} />
          <div className="flex items-center gap-3 text-callout text-ink-muted" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            or with your email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}
      <form action={action} className="flex flex-col gap-5" noValidate>
        {state.error ? <Alert>{state.error}</Alert> : null}
        <TextField
          id="organisation"
          label="Organisation name"
          autoComplete="organization"
          required
          defaultValue={state.values?.organisation}
          error={fe.organisation}
        />
        <TextField id="name" label="Your name" autoComplete="name" required defaultValue={state.values?.name} error={fe.name} />
        <TextField
          id="email"
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={fe.email}
        />
        <PasswordField id="password" label="Password" autoComplete="new-password" showStrength error={fe.password} />
        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Creating your organisation…" : "Continue"}
          </Button>
          <p className="text-center text-callout text-ink-muted">Next you&apos;ll set up an authenticator app for your second step.</p>
        </div>
      </form>
      <p className="border-t border-border pt-4 text-[14px] leading-5 text-ink-muted">
        Already use Tshaeno?{" "}
        <Link href="/sign-in" className="font-medium text-link hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

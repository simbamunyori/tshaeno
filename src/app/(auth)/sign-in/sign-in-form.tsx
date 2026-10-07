"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthHeading } from "@/components/auth/auth-shell";
import { ProviderButtons } from "@/components/auth/provider-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { signInAction, type FormState } from "../actions";

export function SignInForm({
  next,
  notice,
  providers,
}: {
  next: string;
  notice?: { tone: "info" | "negative" | "positive"; text: string };
  providers: { google: boolean; microsoft: boolean };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});
  const message = state.error ? { tone: "negative" as const, text: state.error } : notice;
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading title="Sign in to Tshaeno" />
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <ProviderButtons next={next} providers={providers} passkey />
      <div className="flex items-center gap-3 text-callout text-ink-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or with your email
        <span className="h-px flex-1 bg-border" />
      </div>
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="username webauthn"
          inputMode="email"
          required
          defaultValue={state.values?.email}
        />
        <PasswordField id="password" label="Password" autoComplete="current-password" />
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
      <p className="border-t border-border pt-4 text-[14px] leading-5 text-ink-muted">
        New to Tshaeno?{" "}
        <Link href="/sign-up" className="font-medium text-link hover:underline">
          Create an organisation
        </Link>
      </p>
    </div>
  );
}

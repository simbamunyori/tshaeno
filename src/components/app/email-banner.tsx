"use client";

import { MailWarning } from "lucide-react";
import { useActionState } from "react";
import { resendEmailAction, type ResendState } from "@/app/(auth)/verify-email/actions";

/** Shown until the person who signed up confirms their email address. */
export function EmailBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ResendState, FormData>(resendEmailAction, {});
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-warning-soft px-4 py-3 text-callout text-ink"
    >
      <MailWarning aria-hidden className="size-5 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {state.sent ? (
          <>A new link is on its way to {email}.</>
        ) : state.error ? (
          state.error
        ) : (
          <>
            <span className="font-semibold">Confirm your email.</span> We sent a link to {email}.
          </>
        )}
      </p>
      {state.sent ? null : (
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="font-semibold text-link underline-offset-4 hover:underline disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send a new link"}
          </button>
        </form>
      )}
    </div>
  );
}

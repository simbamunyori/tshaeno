"use server";

import { redirect } from "next/navigation";
import { authDeps, requestContext, requireActiveSession } from "@/server/auth/next";
import { AuthError, confirmEmail, resendEmailCheck } from "@/server/auth/service";
import { kickMail } from "@/server/jobs/queue";

export async function confirmEmailAction(form: FormData) {
  const token = form.get("token");
  if (typeof token !== "string") redirect("/sign-in");
  const state = await confirmEmail(authDeps(), token, await requestContext());
  redirect(state === "CONFIRMED" ? "/verify-email/confirmed" : `/verify-email/${encodeURIComponent(token)}`);
}

export interface ResendState {
  sent?: boolean;
  error?: string;
}

export async function resendEmailAction(): Promise<ResendState> {
  const session = await requireActiveSession();
  try {
    await resendEmailCheck(authDeps(), session);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  await kickMail();
  return { sent: true };
}

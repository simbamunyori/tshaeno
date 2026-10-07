"use server";

import { redirect } from "next/navigation";
import {
  authDeps,
  clearSessionCookie,
  currentSession,
  readSessionToken,
  requestContext,
  safeNext,
  setSessionCookie,
} from "@/server/auth/next";
import {
  acceptInvitationAsExistingUser,
  acceptInvitationAsNewUser,
  addOrganisation,
  AuthError,
  completeSignIn,
  confirmAuthenticatorSetup,
  looksLikeEmail,
  signOut,
  signUp,
  startSignIn,
} from "@/server/auth/service";
import { kickMail } from "@/server/jobs/queue";
import { lockedMessage } from "./messages";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so a failed submit doesn't clear what was typed. */
  values?: Record<string, string>;
  /** Changes on every failed attempt, so code boxes can reset. */
  attempt?: number;
}

export interface SetupState extends FormState {
  recoveryCodes?: string[];
}

function field(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

const WEAK = "Use at least 12 characters, and avoid your name or email.";

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = {
    organisation: field(form, "organisation"),
    name: field(form, "name"),
    email: field(form, "email"),
  };
  const fieldErrors: Record<string, string> = {};
  if (!values.organisation.trim()) fieldErrors.organisation = "Enter your organisation's name.";
  if (!values.name.trim()) fieldErrors.name = "Enter your name.";
  if (!looksLikeEmail(values.email.trim())) fieldErrors.email = "Enter an email address like name@company.com.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  try {
    const { token } = await signUp(
      authDeps(),
      { organisationName: values.organisation, name: values.name, email: values.email, password: field(form, "password") },
      await requestContext(),
    );
    await setSessionCookie(token);
    await kickMail();
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === "email-taken") return { fieldErrors: { email: "There's already an account with this email. Sign in instead." }, values };
      if (e.code === "weak-password") return { fieldErrors: { password: WEAK }, values };
      return { error: e.message, values };
    }
    throw e;
  }
  redirect("/setup-authenticator");
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: field(form, "email") };
  const next = safeNext(field(form, "next")) ?? "/app";
  let stage: string;
  try {
    const result = await startSignIn(authDeps(), { email: values.email, password: field(form, "password") }, await requestContext());
    await setSessionCookie(result.token);
    stage = result.stage;
  } catch (e) {
    if (e instanceof AuthError && e.code === "invalid-credentials") {
      return { error: "That email and password don't match. Check them and try again.", values };
    }
    if (e instanceof AuthError && e.code === "locked") return { error: lockedMessage(e.lockedUntil), values };
    throw e;
  }
  redirect(stage === "SETUP_PENDING" ? "/setup-authenticator" : `/sign-in/code?next=${encodeURIComponent(next)}`);
}

export async function codeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const token = await readSessionToken();
  const next = safeNext(field(form, "next")) ?? "/app";
  const code = field(form, "code") || field(form, "recovery");
  if (!code.trim()) return { error: "Enter the code first." };
  try {
    const result = await completeSignIn(authDeps(), token ?? "", code, await requestContext());
    await setSessionCookie(result.token);
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === "no-session") redirect("/sign-in?expired=1");
      if (e.code === "locked") {
        await clearSessionCookie();
        redirect(`/sign-in?locked=${e.lockedUntil?.toISOString() ?? ""}`);
      }
      return {
        attempt: Date.now(),
        error: field(form, "recovery")
          ? "That backup code didn't work. Each one works only once."
          : "That code didn't work. Codes change every 30 seconds, so use the one showing now.",
      };
    }
    throw e;
  }
  redirect(next);
}

export async function confirmSetupAction(_prev: SetupState, form: FormData): Promise<SetupState> {
  const token = await readSessionToken();
  try {
    const result = await confirmAuthenticatorSetup(authDeps(), token ?? "", field(form, "code"), await requestContext());
    if (result.token) await setSessionCookie(result.token);
    return { recoveryCodes: result.recoveryCodes };
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === "no-session") redirect("/sign-in?expired=1");
      if (e.code === "locked") {
        await clearSessionCookie();
        redirect(`/sign-in?locked=${e.lockedUntil?.toISOString() ?? ""}`);
      }
      return { attempt: Date.now(), error: "That code didn't match. Check the app shows Tshaeno, then enter the code showing now." };
    }
    throw e;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut(authDeps(), await readSessionToken(), await requestContext());
  await clearSessionCookie();
  redirect("/sign-in?signed-out=1");
}

export async function acceptInviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const token = field(form, "token");
  const values = { name: field(form, "name") };
  if (!values.name.trim()) return { fieldErrors: { name: "Enter your name." }, values };
  try {
    const result = await acceptInvitationAsNewUser(authDeps(), token, { name: values.name, password: field(form, "password") }, await requestContext());
    await setSessionCookie(result.token);
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === "weak-password") return { fieldErrors: { password: WEAK }, values };
      if (e.code === "email-taken") return { error: "This email already has a Tshaeno account. Sign in to accept the invitation.", values };
      return { error: e.message, values };
    }
    throw e;
  }
  redirect("/setup-authenticator");
}

export async function joinWithAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await currentSession();
  if (session?.stage !== "ACTIVE") redirect(`/sign-in?next=${encodeURIComponent(`/invite/${field(form, "token")}`)}`);
  try {
    await acceptInvitationAsExistingUser(authDeps(), field(form, "token"), session, await requestContext());
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  redirect("/app?joined=1");
}

/** Someone signed in with no organisation yet (for example, new from Google) starts one. */
export async function createOrganisationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await currentSession();
  if (session?.stage !== "ACTIVE") redirect("/sign-in?expired=1");
  const values = { organisation: field(form, "organisation") };
  try {
    await addOrganisation(authDeps(), session, { name: values.organisation }, await requestContext());
  } catch (e) {
    if (e instanceof AuthError) return { fieldErrors: { organisation: e.message }, values };
    throw e;
  }
  redirect("/app");
}

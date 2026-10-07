import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { currentSession, safeNext } from "@/server/auth/next";
import { enabledProviders } from "@/server/auth/providers";
import { lockedMessage } from "../messages";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  provider: "We couldn't finish signing you in there. Try again, or use another way below.",
  passkey: "That passkey didn't work. Try again, or use another way below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await currentSession();
  if (session?.stage === "ACTIVE") redirect("/app");

  let notice: { tone: "info" | "negative" | "positive"; text: string } | undefined;
  if (typeof params.locked === "string") notice = { tone: "negative", text: lockedMessage(new Date(params.locked)) };
  else if (typeof params.message === "string") notice = { tone: "info", text: params.message.slice(0, 300) };
  else if (typeof params.error === "string" && ERRORS[params.error]) notice = { tone: "negative", text: ERRORS[params.error] };
  else if (params.expired) notice = { tone: "info", text: "Your sign-in timed out. Start again." };
  else if (params["signed-out"]) notice = { tone: "positive", text: "You've signed out." };

  return (
    <AuthShell>
      <SignInForm
        next={safeNext(typeof params.next === "string" ? params.next : null) ?? "/app"}
        notice={notice}
        providers={enabledProviders()}
      />
    </AuthShell>
  );
}

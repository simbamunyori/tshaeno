import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { currentSession } from "@/server/auth/next";
import { enabledProviders } from "@/server/auth/providers";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your organisation" };

export default async function SignUpPage() {
  const session = await currentSession();
  if (session?.stage === "ACTIVE") redirect("/app");
  return (
    <AuthShell title="Signatures for the whole team, in minutes.">
      <SignUpForm providers={{ ...enabledProviders(), fourthgen: false }} />
    </AuthShell>
  );
}

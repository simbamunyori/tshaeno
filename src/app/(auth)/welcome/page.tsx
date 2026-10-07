import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireActiveSession } from "@/server/auth/next";
import { organisationsFor } from "@/server/auth/service";
import { prisma } from "@/server/db";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Set up your organisation" };

/** For someone signed in who doesn't belong to an organisation yet. */
export default async function WelcomePage() {
  const session = await requireActiveSession();
  if ((await organisationsFor(prisma, session.userId)).length > 0) redirect("/app");
  return (
    <AuthShell title="Signatures for the whole team, in minutes.">
      <WelcomeForm name={session.user.name.split(" ")[0]} />
    </AuthShell>
  );
}

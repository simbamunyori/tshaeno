import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { currentSession, homeFor, safeNext } from "@/server/auth/next";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Enter your code" };

export default async function CodePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await currentSession();
  if (session?.stage !== "CODE_PENDING") redirect(session ? homeFor(session) : "/sign-in?expired=1");
  return (
    <AuthShell>
      <CodeForm email={session.user.email} next={safeNext(typeof params.next === "string" ? params.next : null) ?? "/app"} />
    </AuthShell>
  );
}

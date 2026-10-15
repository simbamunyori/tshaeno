import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { ActionForm, ActionTextField } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { portalSession } from "@/server/portal/service";
import { readPortalToken } from "@/server/portal/next";
import { requestLinkAction } from "./actions";

export const metadata: Metadata = { title: "Update your signature" };
export const dynamic = "force-dynamic";

const POINTS: [string, string][] = [
  ["Your photo", "Use one you like, cropped to fit."],
  ["Your social links", "Add your own LinkedIn and others your organisation shows."],
  ["Everything else stays", "Your name, title and phone come from your organisation's directory."],
];

export default async function PortalStart({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await portalSession(await readPortalToken())) redirect("/me/profile");
  const q = await searchParams;
  return (
    <AuthShell title="Your email signature, your way." points={POINTS}>
      <div className="flex flex-col gap-6">
        <AuthHeading title="Update your email signature">Enter your work email and we&apos;ll send you a link. No password needed.</AuthHeading>
        {q.expired ? <Alert tone="info">That visit ended. Ask for a new link.</Alert> : null}
        {q["signed-out"] ? <Alert tone="positive">You&apos;re signed out.</Alert> : null}
        <ActionForm action={requestLinkAction} submit="Send me a link" pending="Sending…">
          <ActionTextField id="email" label="Work email" type="email" autoComplete="email" required />
        </ActionForm>
      </div>
    </AuthShell>
  );
}

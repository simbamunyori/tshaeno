import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { requireActiveSession } from "@/server/auth/next";
import { asUser } from "@/server/db";
import { signOutAction } from "../actions";

export const metadata: Metadata = { title: "Organisation paused" };

/** For someone whose only organisation is suspended. */
export default async function SuspendedPage() {
  const session = await requireActiveSession();
  const memberships = await asUser(session.userId, (tx) =>
    tx.membership.findMany({ where: { userId: session.userId, active: true }, include: { organisation: { include: { partner: { select: { name: true } } } } } }),
  );
  if (memberships.some((m) => m.organisation.status === "ACTIVE")) redirect("/app");
  const paused = memberships.map((m) => m.organisation).filter((o) => o.status === "SUSPENDED");
  if (!paused.length) redirect("/welcome");
  return (
    <AuthShell title="Your organisation is paused.">
      <div className="flex flex-col gap-4">
        {paused.map((o) => (
          <div key={o.id} className="flex flex-col gap-1">
            <h1 className="text-title-2 text-ink">{o.name} is paused</h1>
            <p className="text-body text-ink-muted">
              {o.suspendedByPartner && o.suspendedReason
                ? o.suspendedReason
                : o.suspendedByPartner && o.partner
                  ? `${o.partner.name} has paused it. Contact them to carry on.`
                  : "Tshaeno has paused it. Write to support to carry on."}
            </p>
          </div>
        ))}
        <p className="text-callout text-ink-muted">Nothing has been deleted. Signatures already in people&apos;s mailboxes stay as they are.</p>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

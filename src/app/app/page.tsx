import { CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { asTenant, prisma } from "@/server/db";
import { requireMember } from "@/server/org/context";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { actor, organisation, session } = await requireMember();
  const [members, invited] = await asTenant(organisation.id, (tx) =>
    Promise.all([tx.membership.count({ where: { active: true } }), tx.invitation.count({ where: { acceptedAt: null, revokedAt: null } })]),
  );
  const passkeys = await prisma.passkey.count({ where: { userId: actor.userId } });
  const steps: { done: boolean; title: string; body: string; href?: string }[] = [
    { done: true, title: "Create your organisation", body: `${organisation.name} is ready.` },
    {
      done: members + invited > 1,
      title: "Invite your team",
      body: "Add the people who will manage templates and see reports.",
      href: "/app/team",
    },
    {
      done: session.user.totpEnabled || passkeys > 0,
      title: "Secure your sign-in",
      body: "Add a passkey or an authenticator app.",
      href: "/app/settings/security",
    },
    { done: Boolean(session.user.emailVerifiedAt), title: "Confirm your email", body: "So we can reach you about your account." },
  ];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title={`Hello, ${actor.name.split(" ")[0]}`} />
      {params.joined ? <Alert tone="positive">You&apos;ve joined {organisation.name}.</Alert> : null}
      <Card>
        <CardHeader title="Get set up">A few minutes now, then your team is ready for signatures.</CardHeader>
        <ol className="flex flex-col divide-y divide-border">
          {steps.map((s) => {
            const Icon = s.done ? CircleCheck : Circle;
            const body = (
              <span className="flex items-start gap-3 py-4">
                <Icon aria-hidden className={s.done ? "mt-0.5 size-5 shrink-0 text-positive" : "mt-0.5 size-5 shrink-0 text-border-strong"} />
                <span className="flex flex-col">
                  <span className={s.done ? "font-semibold text-ink-muted line-through decoration-1" : "font-semibold text-ink"}>{s.title}</span>
                  <span className="text-callout text-ink-muted">{s.body}</span>
                </span>
                <span className="sr-only">{s.done ? "Done" : "To do"}</span>
              </span>
            );
            return <li key={s.title}>{s.href && !s.done ? <Link href={s.href} className="block rounded-md hover:bg-surface-2">{body}</Link> : body}</li>;
          })}
        </ol>
      </Card>
      <Card>
        <CardHeader title="Coming next">
          The signature studio, then connecting Google Workspace and Microsoft 365 so every person&apos;s signature is applied for them.
        </CardHeader>
      </Card>
    </div>
  );
}

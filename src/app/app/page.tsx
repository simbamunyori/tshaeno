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
  const [members, invited, kits, people, published, rules, connected, addins] = await asTenant(organisation.id, (tx) =>
    Promise.all([
      tx.membership.count({ where: { active: true } }),
      tx.invitation.count({ where: { acceptedAt: null, revokedAt: null } }),
      tx.brandKit.count({ where: { logoAssetId: { not: null } } }),
      tx.person.count(),
      tx.signatureTemplate.count({ where: { publishedVersionId: { not: null }, archivedAt: null } }),
      tx.signatureAssignment.count(),
      tx.directoryConnection.count({ where: { status: "CONNECTED" } }),
      tx.outlookAddin.count(),
    ]),
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
    { done: kits > 0, title: "Add your logo to the brand kit", body: "And your colours, font, disclaimer and social links.", href: "/app/brand" },
    {
      done: connected > 0,
      title: "Connect Google Workspace or Microsoft 365",
      body: "Your people come in and stay up to date, and Gmail signatures are set for you.",
      href: "/app/connections",
    },
    { done: people > 0, title: "Add your people", body: "From your directory, by hand, or from a spreadsheet.", href: "/app/people" },
    { done: published > 0, title: "Design and publish a signature", body: "Start from one of the industry templates or build your own.", href: "/app/signatures" },
    { done: rules > 0, title: "Decide who gets it", body: "Everyone, a group, a department, an office or one person.", href: "/app/signatures" },
    { done: addins > 0, title: "Deploy the Outlook add-in", body: "If you use Outlook, so signatures appear as people write.", href: "/app/connections" },
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
          A guided start for small teams, plans and billing, and a self-service page where people update their own photo and links.
        </CardHeader>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UpgradePanel } from "@/components/app/upgrade-panel";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { toLocalInput } from "@/lib/zoned-time";
import { awayList, type AwayState } from "@/server/away/service";
import { orgAccess } from "@/server/billing/premium";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { cancelAwayAction } from "./actions";
import { AwayForm } from "./away-form";

export const metadata: Metadata = { title: "Out-of-office" };

const STATE: Record<AwayState, { label: string; tone: string }> = {
  on: { label: "On now", tone: "bg-positive-soft text-positive" },
  scheduled: { label: "Scheduled", tone: "bg-brand-soft text-link" },
  ended: { label: "Ended", tone: "bg-surface-2 text-ink-muted" },
  cancelled: { label: "Cancelled", tone: "bg-surface-2 text-ink-muted" },
};

const DAY = 86_400_000;

export default async function AwayPage() {
  const { actor, organisation } = await requireMember();
  const plan = await orgAccess(organisation.id);
  const header = (
    <>
      <PageHeader eyebrow={organisation.name} title="Out-of-office" />
      <p className="-mt-4 max-w-2xl text-body text-ink-muted">
        Set someone&apos;s out-of-office reply for them, in Gmail or Outlook, with your wording and their signature. It switches itself on when they leave and off when they&apos;re back.
      </p>
    </>
  );
  if (!plan.premium) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <UpgradePanel feature="away" partner={plan.partner} canBill={can(actor, "manageBilling")} />
      </div>
    );
  }
  if (!can(actor, "view")) notFound();
  const now = new Date();
  const { list, people } = await asTenant(organisation.id, async (tx) => ({
    list: await awayList(tx, now),
    people: (await tx.person.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true, email: true, phone: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: 2000 })).map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      phone: p.phone,
    })),
  }));
  const manage = can(actor, "manageDirectory");
  const when = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: organisation.timeZone });
  const tomorrow = new Date(Math.ceil(now.getTime() / DAY) * DAY + 7 * 3_600_000);
  const defaults = { startsAt: toLocalInput(tomorrow, organisation.timeZone), endsAt: toLocalInput(new Date(tomorrow.getTime() + 7 * DAY), organisation.timeZone) };

  return (
    <div className="flex flex-col gap-8">
      {header}
      {list.length ? (
        <Card>
          <CardHeader title="Replies" />
          <ul className="flex flex-col divide-y divide-border">
            {list.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{`${a.person.firstName} ${a.person.lastName}`.trim()}</span>
                    {a.status === "FAILED" ? (
                      <span className="rounded-full bg-negative-soft px-2 py-0.5 text-caption font-semibold text-negative">Not set</span>
                    ) : (
                      <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", STATE[a.state].tone)}>{STATE[a.state].label}</span>
                    )}
                  </div>
                  <span className="text-callout text-ink-muted">
                    {when.format(a.startsAt)} to {when.format(a.endsAt)}
                    {a.mailbox && a.status === "SET" ? `, in ${a.mailbox}` : ""}. Set by {a.setBy}.
                  </span>
                  {a.lastError ? <span className="text-callout text-negative">{a.lastError}</span> : null}
                  <details className="text-callout">
                    <summary className="cursor-pointer text-link">The message</summary>
                    <p className="mt-2 font-semibold text-ink">{a.subject}</p>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{a.message}</p>
                  </details>
                </div>
                {manage && (a.state === "on" || a.state === "scheduled") ? (
                  <ActionForm action={cancelAwayAction} submit="Cancel" variant="secondary" pending="Cancelling…">
                    <input type="hidden" name="id" value={a.id} />
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {manage ? (
        <Card>
          <CardHeader title="Set an out-of-office reply" />
          <AwayForm people={people} defaults={defaults} />
        </Card>
      ) : null}
    </div>
  );
}

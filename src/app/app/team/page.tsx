import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { initials } from "@/lib/initials";
import { asTenant } from "@/server/db";
import { assignableRoles, can, ROLE_LABEL, ROLE_SUMMARY, ROLES } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { resendAction, revokeAction } from "./actions";
import { InviteForm, MemberControls } from "./team-forms";

export const metadata: Metadata = { title: "Team" };

const day = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: tz }).format(d);

export default async function TeamPage() {
  const { actor, organisation } = await requireMember();
  const [members, invitations] = await asTenant(organisation.id, (tx) =>
    Promise.all([
      tx.membership.findMany({ where: { active: true }, include: { user: true }, orderBy: { createdAt: "asc" } }),
      tx.invitation.findMany({
        where: { acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: "desc" },
        include: { invitedBy: { include: { user: true } } },
      }),
    ]),
  );
  const manage = can(actor, "manageMembers");
  const giveable = assignableRoles(actor);
  const roleOptions = giveable.map((r) => ({ value: r, label: ROLE_LABEL[r] }));
  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="Team" />
      {manage ? (
        <Card>
          <CardHeader title="Invite someone">They get an email with a link that works for seven days.</CardHeader>
          <InviteForm roles={roleOptions} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title={members.length === 1 ? "1 person" : `${members.length} people`} />
        <ul className="flex flex-col divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-callout font-semibold text-link">
                {initials(m.user.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-ink">
                  {m.user.name}
                  {m.userId === actor.userId ? <span className="font-normal text-ink-muted"> (you)</span> : null}
                </span>
                <span className="truncate text-callout text-ink-muted">{m.user.email}</span>
              </span>
              {manage && m.userId !== actor.userId && giveable.includes(m.role) ? (
                <MemberControls id={m.id} name={m.user.name} role={m.role} roles={roleOptions} />
              ) : (
                <span className="text-callout text-ink-muted">{ROLE_LABEL[m.role]}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {invitations.length ? (
        <Card>
          <CardHeader title="Waiting to accept" />
          <ul className="flex flex-col divide-y divide-border">
            {invitations.map((inv) => {
              const expired = inv.expiresAt.getTime() <= now.getTime();
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-ink">{inv.email}</span>
                    <span className="text-callout text-ink-muted">
                      {ROLE_LABEL[inv.role]} · invited by {inv.invitedBy.user.name} ·{" "}
                      {expired ? "expired" : `works until ${day(inv.expiresAt, organisation.timeZone)}`}
                    </span>
                  </span>
                  {manage && giveable.includes(inv.role) ? (
                    <span className="flex gap-4">
                      <form action={resendAction}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button className="text-callout font-semibold text-link hover:underline">Send again</button>
                      </form>
                      <form action={revokeAction}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button className="text-callout font-semibold text-negative hover:underline">Withdraw</button>
                      </form>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="What each role can do" />
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[180px_1fr]">
          {ROLES.map((r) => (
            <div key={r} className="contents">
              <dt className="font-semibold text-ink">{ROLE_LABEL[r]}</dt>
              <dd className="text-ink-muted">{ROLE_SUMMARY[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

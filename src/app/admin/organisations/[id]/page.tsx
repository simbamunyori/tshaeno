import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DomainError, ROLE_LABEL } from "@/server/org/access";
import { organisationDetail } from "@/server/platform/service";
import { requireStaff } from "../../staff";
import { BillingSection } from "./billing";
import { StatusForm } from "./status-form";

export default async function AdminOrganisation({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const org = await organisationDetail(staff, (await params).id).catch((e) => {
    if (e instanceof DomainError) notFound();
    throw e;
  });
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: org.timeZone });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={org.slug} title={org.name} />
      <Card>
        <CardHeader title={org.status === "SUSPENDED" ? "Suspended" : "Active"}>
          {org.status === "SUSPENDED"
            ? `${org.suspendedByPartner ? `Paused by ${org.partner?.name ?? "its partner"}` : "Suspended by staff"}. Nobody in this organisation can sign in. Nothing has been deleted.`
            : "Created " + when.format(org.createdAt) + "."}
        </CardHeader>
        {org.partner ? (
          <p className="mb-4 text-callout text-ink">
            Set up by{" "}
            <Link href={`/admin/partners/${org.partner.id}`} className="font-semibold text-link hover:underline">
              {org.partner.name}
            </Link>
            , their reference <code className="font-mono">{org.partnerReference}</code>.
          </p>
        ) : null}
        <StatusForm id={org.id} suspended={org.status === "SUSPENDED"} />
      </Card>
      <BillingSection staff={staff} organisationId={org.id} timeZone={org.timeZone} />
      <Card>
        <CardHeader title="Getting started" />
        <p className="text-callout text-ink">
          {org.firstSignatureAt
            ? `First signature live ${when.format(org.firstSignatureAt)}, ${Math.max(0, Math.round((org.firstSignatureAt.getTime() - org.createdAt.getTime()) / 60_000))} minutes after sign-up.`
            : "No signature is live yet."}
        </p>
      </Card>
      <Card>
        <CardHeader title="People" />
        <ul className="flex flex-col divide-y divide-border">
          {org.memberships.map((m) => (
            <li key={m.id} className="flex flex-wrap gap-x-4 py-3">
              <span className="min-w-0 flex-1 truncate text-ink">
                {m.user.name} <span className="text-ink-muted">{m.user.email}</span>
              </span>
              <span className="text-callout text-ink-muted">{ROLE_LABEL[m.role]}</span>
              <span className="text-callout text-ink-muted">{m.user.lastLoginAt ? `last in ${when.format(m.user.lastLoginAt)}` : "never signed in"}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Recent activity" />
        <ul className="flex flex-col divide-y divide-border">
          {org.auditLogs.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-4 py-2 text-callout">
              <span className="w-[170px] text-ink-muted tabular-nums">{when.format(a.createdAt)}</span>
              <span className="flex-1 text-ink">{a.action}</span>
              <span className="text-ink-muted">{a.actorLabel}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

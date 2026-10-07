import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollText } from "lucide-react";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { ACTION_LABEL } from "@/server/org/audit";
import { requireMember } from "@/server/org/context";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 100;

function describe(action: string, data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  const base = ACTION_LABEL[action] ?? action.replace(/[._]/g, " ");
  if (typeof d.email === "string") return `${base}: ${d.email}`;
  if (typeof d.to === "string" && typeof d.from === "string") return `${base}: ${d.from} to ${d.to}`;
  if (typeof d.reason === "string") return `${base}: ${d.reason}`;
  return base;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { actor, organisation } = await requireMember();
  if (!can(actor, "viewAudit")) redirect("/app");
  const before = (await searchParams).before;
  const rows = await asTenant(organisation.id, (tx) =>
    tx.auditLog.findMany({
      where: before ? { createdAt: { lt: new Date(before) } } : undefined,
      orderBy: { createdAt: "desc" },
      take: PAGE,
    }),
  );
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: organisation.timeZone });
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="Audit log" />
      <p className="-mt-4 max-w-[640px] text-ink-muted">Every change in your organisation, who made it and when. Nobody can edit or delete these records, including us.</p>
      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing yet" />
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                <time className="shrink-0 text-callout text-ink-muted tabular-nums sm:w-[170px]" dateTime={r.createdAt.toISOString()}>
                  {when.format(r.createdAt)}
                </time>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-ink">{describe(r.action, r.data)}</span>
                <span className="shrink-0 text-callout text-ink-muted">{r.actorLabel}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {rows.length === PAGE ? (
        <a href={`/app/audit?before=${encodeURIComponent(rows[rows.length - 1].createdAt.toISOString())}`} className="self-start font-semibold text-link hover:underline">
          Older entries
        </a>
      ) : null}
    </div>
  );
}

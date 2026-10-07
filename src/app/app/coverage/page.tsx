import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { resolveAssignments } from "@/lib/signature/rules";
import { asTenant } from "@/server/db";
import { coverageOf, type CoverageStatus } from "@/server/delivery/coverage";
import { requireMember } from "@/server/org/context";
import { liveRules } from "@/server/signatures/templates";

export const metadata: Metadata = { title: "Coverage" };

const TABS: { key: CoverageStatus | "all"; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "missing", label: "Without a signature" },
  { key: "problem", label: "Problems" },
  { key: "waiting", label: "Waiting" },
  { key: "covered", label: "Has it" },
];

const TONE: Record<CoverageStatus, string> = {
  covered: "bg-positive-soft text-positive",
  waiting: "bg-brand-soft text-link",
  problem: "bg-negative-soft text-negative",
  missing: "bg-warning-soft text-warning",
};
const LABEL: Record<CoverageStatus, string> = { covered: "Has it", waiting: "Waiting", problem: "Problem", missing: "Without" };

const SHOWN = 500;

export default async function CoveragePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show: raw } = await searchParams;
  const show = (TABS.find((t) => t.key === raw)?.key ?? "all") as CoverageStatus | "all";
  const { organisation } = await requireMember();
  const data = await asTenant(organisation.id, async (tx) => {
    const [people, rules, google, addin, templates, inactive] = await Promise.all([
      tx.person.findMany({
        where: { active: true },
        select: { id: true, firstName: true, lastName: true, email: true, department: true, location: true, groups: true, source: true, deliveries: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      liveRules(tx),
      tx.directoryConnection.findFirst({ where: { provider: "GOOGLE" }, select: { pushEnabled: true, status: true } }),
      tx.outlookAddin.findFirst({ select: { id: true } }),
      tx.signatureTemplate.findMany({ select: { id: true, name: true } }),
      tx.person.count({ where: { active: false } }),
    ]);
    return { people, rules, google, addin, names: new Map(templates.map((t) => [t.id, t.name])), inactive };
  });

  const googlePush = !!data.google?.pushEnabled && data.google.status !== "PENDING";
  const rows = data.people.map((p) => {
    const resolved = resolveAssignments(p, data.rules);
    const templateId = resolved.newEmail ?? resolved.reply;
    const cov = coverageOf({
      hasRule: !!templateId,
      inGoogle: p.source === "GOOGLE",
      googlePush,
      addinDeployed: !!data.addin,
      gmail: p.deliveries.find((d) => d.target === "GMAIL") ?? null,
      outlook: p.deliveries.find((d) => d.target === "OUTLOOK") ?? null,
    });
    return { p, cov, template: templateId ? data.names.get(templateId) : null };
  });
  const counts = Object.fromEntries(TABS.map((t) => [t.key, t.key === "all" ? rows.length : rows.filter((r) => r.cov.status === t.key).length])) as Record<string, number>;
  const visible = (show === "all" ? rows : rows.filter((r) => r.cov.status === show)).slice(0, SHOWN);
  const total = show === "all" ? rows.length : counts[show];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Coverage" />
      <p className="-mt-4 max-w-2xl text-body text-ink-muted">
        Who has their signature in Gmail or Outlook, who doesn&apos;t, and why. Gmail is set directly; Outlook counts once the add-in has put a signature in for someone in the last 30 days.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["covered", "waiting", "problem", "missing"] as const).map((k) => (
          <Link key={k} href={`/app/coverage?show=${k}`} className="rounded-lg border border-border bg-surface-1 p-4 hover:bg-surface-2">
            <span className="block text-title-2 text-ink">{counts[k]}</span>
            <span className="text-callout text-ink-muted">{TABS.find((t) => t.key === k)!.label}</span>
          </Link>
        ))}
      </div>

      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/app/coverage" : `/app/coverage?show=${t.key}`}
            aria-current={show === t.key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-callout", show === t.key ? "border-brand bg-brand-soft font-semibold text-link" : "border-border text-ink-muted hover:bg-surface-2")}
          >
            {t.label} ({counts[t.key]})
          </Link>
        ))}
      </nav>

      <Card className="p-0 sm:p-0">
        {visible.length === 0 ? (
          <p className="p-5 text-callout text-ink-muted">{rows.length === 0 ? "No people yet. Add them on the People page or connect a directory." : "Nobody here."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-callout">
              <thead className="border-b border-border text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Person</th>
                  <th className="px-3 py-3 font-semibold">Signature</th>
                  <th className="px-3 py-3 font-semibold">Gmail</th>
                  <th className="px-3 py-3 font-semibold">Outlook</th>
                  <th className="px-5 py-3 font-semibold">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(({ p, cov, template }) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-5 py-3">
                      <Link href={`/app/people/${p.id}`} className="font-semibold text-ink hover:underline">
                        {`${p.firstName} ${p.lastName}`.trim()}
                      </Link>
                      <span className="block text-ink-muted">{p.email}</span>
                    </td>
                    <td className="px-3 py-3 text-ink">{template ?? <span className="text-ink-muted">None</span>}</td>
                    <td className="px-3 py-3 text-ink">{cov.gmail ?? <span className="text-ink-muted">Not used</span>}</td>
                    <td className="px-3 py-3 text-ink">{cov.outlook ?? <span className="text-ink-muted">Not used</span>}</td>
                    <td className="px-5 py-3">
                      <span className={cn("mr-2 inline-flex rounded-full px-2 py-0.5 text-caption font-semibold", TONE[cov.status])}>{LABEL[cov.status]}</span>
                      <span className="text-ink-muted">{cov.reason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {total > SHOWN ? <p className="text-callout text-ink-muted">Showing the first {SHOWN} of {total}.</p> : null}
      {data.inactive ? (
        <p className="text-callout text-ink-muted">
          {data.inactive} {data.inactive === 1 ? "person is" : "people are"} switched off because they were suspended or removed in the directory, and aren&apos;t counted.
        </p>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { listOrganisations, onboardingStats } from "@/server/platform/service";
import { requireStaff } from "./staff";

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff();
  const q = (await searchParams).q ?? "";
  const [orgs, stats] = await Promise.all([listOrganisations(staff, q), onboardingStats(staff)]);
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Organisations" />
      <Card>
        <CardHeader title="Getting started, last 30 days">The goal: a new small team has its first signature live within 20 minutes of signing up.</CardHeader>
        <dl className="grid gap-4 text-callout sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted">Signed up</dt>
            <dd className="text-title-2 text-ink tabular-nums">{stats.signedUp}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">First signature live</dt>
            <dd className="text-title-2 text-ink tabular-nums">{stats.live}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Median time to it</dt>
            <dd className="text-title-2 text-ink tabular-nums">{stats.medianMinutes == null ? "None yet" : `${stats.medianMinutes} min`}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Live within 20 minutes</dt>
            <dd className="text-title-2 text-ink tabular-nums">{stats.within20 == null ? "None yet" : `${stats.within20}%`}</dd>
          </div>
        </dl>
        {stats.quoteRequests.length ? (
          <div className="mt-6">
            <h3 className="text-callout font-semibold text-ink">Enterprise quote requests</h3>
            <ul className="mt-2 flex flex-col divide-y divide-border text-callout">
              {stats.quoteRequests.map((r) => (
                <li key={`${r.organisationId}-${r.at.toISOString()}`} className="flex flex-wrap gap-x-4 py-2">
                  <Link href={`/admin/organisations/${r.organisationId}`} className="font-semibold text-link hover:underline">
                    {r.organisation}
                  </Link>
                  <span className="text-ink-muted">{day.format(r.at)}</span>
                  <span className="text-ink">about {String((r.data as { people?: number } | null)?.people ?? "?")} people</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      <form className="flex gap-3 sm:max-w-[480px]" role="search">
        <label htmlFor="q" className="sr-only">Search by name</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name" className={inputClass} />
      </form>
      <p className="text-callout text-ink-muted">Every search and every organisation you open is recorded in the staff log.</p>
      <Card className="p-0 sm:p-0">
        <ul className="flex flex-col divide-y divide-border">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/organisations/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{o.name}</span>
                {o.status === "SUSPENDED" ? <span className="rounded-full bg-negative-soft px-2 py-0.5 text-caption font-semibold text-negative">Suspended</span> : null}
                <span className="text-callout text-ink-muted">{o._count.memberships} people</span>
                <span className="text-callout text-ink-muted">since {day.format(o.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {orgs.length === 0 ? <p className="px-5 py-6 text-ink-muted">No organisations match.</p> : null}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { listOrganisations } from "@/server/platform/service";
import { requireStaff } from "./staff";

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff();
  const q = (await searchParams).q ?? "";
  const orgs = await listOrganisations(staff, q);
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Organisations" />
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

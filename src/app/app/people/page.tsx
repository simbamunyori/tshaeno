import { Contact, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { initials } from "@/lib/initials";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { removeFieldAction } from "./actions";
import { AddFieldForm, ImportForm, PersonForm } from "./people-forms";

export const metadata: Metadata = { title: "People" };

const PAGE = 200;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { actor, organisation } = await requireMember();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { department: { contains: q, mode: "insensitive" as const } },
          { title: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const { people, total, fields, departments } = await asTenant(organisation.id, async (tx) => ({
    people: await tx.person.findMany({ where, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: PAGE }),
    total: await tx.person.count(),
    fields: await tx.customField.findMany({ orderBy: { createdAt: "asc" } }),
    departments: (await tx.person.findMany({ distinct: ["department"], select: { department: true }, where: { department: { not: "" } } })).map((d) => d.department).sort(),
  }));
  const manage = can(actor, "manageDirectory");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="People" />
      <p className="-mt-4 max-w-2xl text-body text-ink-muted">
        Everyone who gets a signature, with the details it shows. Connecting Google Workspace or Microsoft 365 will keep this list in step automatically.
      </p>

      {total === 0 && !manage ? (
        <EmptyState icon={Contact} title="Nobody in the directory yet">
          An owner or admin can add people here.
        </EmptyState>
      ) : (
        <Card>
          <CardHeader title={total === 1 ? "1 person" : `${total.toLocaleString("en")} people`} />
          <form className="mb-4 flex gap-2" role="search">
            <label htmlFor="q" className="sr-only">
              Search people
            </label>
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <input id="q" name="q" defaultValue={q} placeholder="Search by name, email, title or department" className={`${inputClass} pl-9`} />
            </div>
          </form>
          {people.length === 0 ? (
            <p className="text-callout text-ink-muted">{q ? "Nobody matches that search." : "Nobody yet. Add someone below or import a spreadsheet."}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {people.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/people/${p.id}`} className="flex items-center gap-4 py-3 hover:bg-surface-2/60">
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-callout font-semibold text-link">
                      {initials(`${p.firstName} ${p.lastName}`)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold text-ink">
                        {p.firstName} {p.lastName}
                        {!p.active ? <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-caption font-semibold text-ink-muted">Switched off</span> : null}
                        {p.source === "GOOGLE" || p.source === "MICROSOFT" ? (
                          <span className="ml-2 text-caption font-normal text-ink-muted">from {p.source === "GOOGLE" ? "Google" : "Microsoft"}</span>
                        ) : null}
                      </span>
                      <span className="truncate text-callout text-ink-muted">
                        {[p.title, p.department].filter(Boolean).join(", ") || p.email}
                      </span>
                    </span>
                    <span className="hidden truncate text-callout text-ink-muted sm:block">{p.email}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {people.length === PAGE ? <p className="mt-3 text-callout text-ink-muted">Showing the first {PAGE}. Search to find someone else.</p> : null}
        </Card>
      )}

      {manage ? (
        <>
          <Card>
            <CardHeader title="Add someone" />
            <PersonForm customFields={fields} departments={departments} />
          </Card>
          <Card>
            <CardHeader title="Import from a spreadsheet">Save your sheet as CSV first. Excel and Google Sheets both can.</CardHeader>
            <ImportForm />
          </Card>
          <Card>
            <CardHeader title="Custom fields">
              Extra details for signatures, such as pronouns, a booking link or a licence number. Link one to a directory attribute and every sync fills it in.
            </CardHeader>
            {fields.length ? (
              <ul className="mb-5 flex flex-col divide-y divide-border">
                {fields.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="flex flex-col">
                      <span className="font-semibold text-ink">{f.label}</span>
                      <code className="text-callout text-ink-muted">{`{{custom.${f.key}}}`}</code>
                      {f.sourceAttribute ? <span className="text-callout text-ink-muted">Filled from the directory&apos;s {f.sourceAttribute}</span> : null}
                    </span>
                    <form action={removeFieldAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className="text-callout font-semibold text-negative hover:underline">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <AddFieldForm />
          </Card>
        </>
      ) : null}
    </div>
  );
}

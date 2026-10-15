import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listPartners } from "@/server/partner/service";
import { requireStaff } from "../staff";
import { NewPartnerForm } from "./partner-forms";

export const metadata = { title: "Partners" };

export default async function PartnersPage() {
  const staff = await requireStaff();
  const partners = await listPartners(staff);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Partners" />
      <p className="text-callout text-ink-muted">
        Resellers such as Fourth Generation Technologies set up and bill organisations through the partner API. How it works is in docs/partner-api.md.
      </p>
      <Card>
        <CardHeader title="Add a partner">They get a key and a secret for signing requests.</CardHeader>
        <NewPartnerForm />
      </Card>
      {partners.length ? (
        <Card>
          <CardHeader title="Partners" />
          <ul className="flex flex-col divide-y divide-border">
            {partners.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <Link href={`/admin/partners/${p.id}`} className="font-semibold text-link hover:underline">
                  {p.name}
                </Link>
                <code className="font-mono text-caption text-ink-muted">{p.keyId}</code>
                <span className="text-callout text-ink-muted">
                  {p._count.organisations} {p._count.organisations === 1 ? "organisation" : "organisations"}
                </span>
                {!p.active ? <span className="rounded-full bg-negative-soft px-2 py-0.5 text-caption font-semibold text-negative">Turned off</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

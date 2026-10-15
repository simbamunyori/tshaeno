import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ActionTextField } from "@/components/ui/action-form";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TIER_LABEL } from "@/lib/billing/plans";
import { partnerDetail } from "@/server/partner/service";
import { requireStaff } from "../../staff";
import { updatePartnerAction } from "../actions";
import { RotateSecretForm } from "../partner-forms";

export const metadata = { title: "Partner" };

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const found = await partnerDetail(staff, id);
  if (!found) notFound();
  const { partner, organisations, requests } = found;
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Gaborone" });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Partner" title={partner.name} />
      <Card>
        <CardHeader title="Key and secret">
          Key <code className="font-mono">{partner.keyId}</code>. Only a sealed copy of the secret is kept. A new secret replaces the old one at once.
        </CardHeader>
        <RotateSecretForm id={partner.id} />
      </Card>
      <Card>
        <CardHeader title="Settings" />
        <ActionForm action={updatePartnerAction} submit="Save">
          <input type="hidden" name="id" value={partner.id} />
          <ActionTextField id="name" label="Name" defaultValue={partner.name} />
          <ActionTextField
            id="allowedIps"
            label="Allowed addresses"
            defaultValue={partner.allowedIps.join(", ")}
            hint="IP addresses the partner calls from, separated by commas. Leave empty to allow any."
            autoComplete="off"
          />
          <ActionTextField
            id="wholesaleDiscountPercent"
            label="Wholesale discount, in percent"
            inputMode="numeric"
            defaultValue={String(partner.wholesaleDiscountPercent)}
            hint="Taken off retail prices in what the API reports as their price."
          />
          <label className="flex items-start gap-3 text-body text-ink">
            <input type="checkbox" name="active" defaultChecked={partner.active} className="mt-1 size-4 accent-[var(--brand)]" />
            <span>
              Calls are accepted <span className="text-callout text-ink-muted">Turn off to refuse every call with this key.</span>
            </span>
          </label>
        </ActionForm>
      </Card>
      <Card>
        <CardHeader title={`Organisations (${organisations.length})`} />
        {organisations.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {organisations.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-callout">
                <Link href={`/admin/organisations/${o.id}`} className="font-semibold text-link hover:underline">
                  {o.name}
                </Link>
                <code className="font-mono text-caption text-ink-muted">{o.partnerReference}</code>
                <span className="text-ink-muted">
                  {o.subscription ? `${TIER_LABEL[o.subscription.tier]}, ${o.subscription.seats} ${o.subscription.seats === 1 ? "seat" : "seats"}` : ""}
                  {o.status === "SUSPENDED" ? ", suspended" : o.subscription?.status === "CANCELLED" ? ", cancelled" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-callout text-ink-muted">None yet.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Latest calls">The last 50. The full log can&apos;t be changed.</CardHeader>
        {requests.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-callout">
              <thead className="text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-semibold">When</th>
                  <th className="py-2 pr-4 font-semibold">Call</th>
                  <th className="py-2 pr-4 font-semibold">Answer</th>
                  <th className="py-2 font-semibold">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-ink-muted">{when.format(r.createdAt)}</td>
                    <td className="py-2 pr-4 font-mono text-[13px] break-all text-ink">
                      {r.method} {r.path}
                    </td>
                    <td className={`py-2 pr-4 tabular-nums ${r.status >= 400 ? "text-negative" : "text-ink"}`}>{r.status}</td>
                    <td className="py-2 font-mono text-[13px] text-ink-muted">{r.ipAddress ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-callout text-ink-muted">No calls yet.</p>
        )}
      </Card>
    </div>
  );
}

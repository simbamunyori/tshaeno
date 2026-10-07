import { ActionForm, ActionTextField } from "@/components/ui/action-form";
import { Card, CardHeader } from "@/components/ui/card";
import { TIER_LABEL, formatMoney } from "@/lib/billing/plans";
import type { StaffMember } from "@/server/platform/service";
import { organisationBilling } from "@/server/platform/service";
import { bankPaymentAction, customPriceAction, extendTrialAction, voidInvoiceAction } from "../../actions";

const STATUS = { TRIALING: "Trial", FREE: "Free", ACTIVE: "Paid", PAST_DUE: "Renewal overdue" } as const;

/** The organisation's plan and invoices, with what staff can do about them. */
export async function BillingSection({ staff, organisationId, timeZone }: { staff: StaffMember; organisationId: string; timeZone: string }) {
  const { sub, invoices, people } = await organisationBilling(staff, organisationId);
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone });
  if (!sub) return null;
  const open = invoices.filter((i) => i.status === "OPEN");
  return (
    <Card>
      <CardHeader title={`Plan: ${STATUS[sub.status]}${sub.billedBy === "PARTNER" ? ", billed by partner" : ""}`}>
        {sub.status === "TRIALING" && sub.trialEndsAt ? `Trial until ${day.format(sub.trialEndsAt)}. ` : ""}
        {sub.status === "ACTIVE" || sub.status === "PAST_DUE"
          ? `${TIER_LABEL[sub.tier]}, ${sub.seats} people, ${sub.interval === "ANNUAL" ? "yearly" : "monthly"} in ${sub.currency}, until ${sub.periodEnd ? day.format(sub.periodEnd) : "?"}. `
          : ""}
        {people} active people in the directory.
        {sub.customMinor != null ? ` Agreed price ${formatMoney(sub.customMinor, sub.currency)} a person a month.` : ""}
      </CardHeader>

      <div className="flex flex-col gap-8">
        {open.map((i) => (
          <div key={i.id} className="flex flex-col gap-4 rounded-md border border-border p-4">
            <p className="text-body text-ink">
              <strong>{i.number}</strong>, {formatMoney(i.totalMinor, i.currency)}, issued {day.format(i.issuedAt)}, {i.kind.toLowerCase()}
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <ActionForm action={bankPaymentAction} submit="Record bank payment">
                <>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="organisationId" value={organisationId} />
                  <ActionTextField id="reference" label="Bank reference" hint="Check the amount matches before recording it." />
                </>
              </ActionForm>
              <ActionForm action={voidInvoiceAction} submit="Cancel invoice" variant="secondary">
                <>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="organisationId" value={organisationId} />
                  <ActionTextField id="reason" label="Reason" />
                </>
              </ActionForm>
            </div>
          </div>
        ))}

        <div className="grid gap-6 md:grid-cols-2">
          {sub.status === "TRIALING" || sub.status === "FREE" ? (
            <ActionForm action={extendTrialAction} submit="Extend trial" variant="secondary">
              <>
                <input type="hidden" name="organisationId" value={organisationId} />
                <ActionTextField id="days" label="Days to add" type="number" min={1} max={90} defaultValue={14} className="sm:max-w-[200px]" />
              </>
            </ActionForm>
          ) : null}
          <ActionForm action={customPriceAction} submit="Save price" variant="secondary">
            <>
              <input type="hidden" name="organisationId" value={organisationId} />
              <ActionTextField
                id="price"
                label={`Agreed price per person per month, ${sub.currency}`}
                inputMode="decimal"
                defaultValue={sub.customMinor != null ? (sub.customMinor / 100).toFixed(2) : ""}
                hint="For Enterprise quotes. Leave empty to use the price list."
                className="sm:max-w-[320px]"
              />
            </>
          </ActionForm>
        </div>

        {invoices.length ? (
          <ul className="flex flex-col divide-y divide-border text-callout">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-4 py-2">
                <span className="font-semibold text-ink tabular-nums">{i.number}</span>
                <span className="text-ink-muted">{day.format(i.issuedAt)}</span>
                <span className="flex-1 text-right text-ink tabular-nums">{formatMoney(i.totalMinor, i.currency)}</span>
                <span className="w-[90px] text-right text-ink-muted">{i.status === "PAID" ? "Paid" : i.status === "VOID" ? "Cancelled" : "Open"}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

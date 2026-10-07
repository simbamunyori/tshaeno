import { ActionForm, ActionTextField } from "@/components/ui/action-form";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CURRENCIES, CURRENCY_LABEL, TIER_LABEL, annualSaving, formatMoney, rangeLabel, type PlanTier } from "@/lib/billing/plans";
import { listPrices } from "@/server/platform/service";
import { setPriceAction } from "../actions";
import { requireStaff } from "../staff";

export const metadata = { title: "Prices" };

const BANDS: PlanTier[] = ["STARTER", "GROWTH", "BUSINESS"];
const plain = (minor: number) => (minor / 100).toFixed(2);

export default async function PricesPage() {
  const staff = await requireStaff();
  const prices = await listPrices(staff);
  const updated = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Prices" />
      <p className="text-callout text-ink-muted">
        Per person per month. New invoices use these; invoices already issued don&apos;t change. Enterprise is priced per organisation, on its page. Every change is in the staff
        log.
      </p>
      {CURRENCIES.map((c) => (
        <Card key={c}>
          <CardHeader title={`${c}, ${CURRENCY_LABEL[c]}`} />
          <div className="grid gap-6 lg:grid-cols-3">
            {BANDS.map((t) => {
              const p = prices.find((x) => x.tier === t && x.currency === c);
              return (
                <div key={t} className="flex flex-col gap-3 rounded-md border border-border p-4">
                  <div>
                    <p className="font-semibold text-ink">{TIER_LABEL[t]}</p>
                    <p className="text-callout text-ink-muted">{rangeLabel(t)}</p>
                    {p ? (
                      <p className="text-caption text-ink-muted">
                        Yearly saves {annualSaving(p)}%. {p.updatedBy ? `Changed by ${p.updatedBy}, ${updated.format(p.updatedAt)}.` : ""}
                      </p>
                    ) : null}
                  </div>
                  <ActionForm action={setPriceAction} submit="Save">
                    <>
                      <input type="hidden" name="tier" value={t} />
                      <input type="hidden" name="currency" value={c} />
                      <ActionTextField
                        id="monthly"
                        label="Billed monthly"
                        inputMode="decimal"
                        defaultValue={p ? plain(p.monthlyMinor) : ""}
                        hint={p ? `Now ${formatMoney(p.monthlyMinor, c)}` : "Not set"}
                      />
                      <ActionTextField
                        id="annual"
                        label="Billed yearly"
                        inputMode="decimal"
                        defaultValue={p ? plain(p.annualMinor) : ""}
                        hint={p ? `Now ${formatMoney(p.annualMinor, c)}` : "Not set"}
                      />
                    </>
                  </ActionForm>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

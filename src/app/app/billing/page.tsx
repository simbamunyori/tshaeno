import type { Metadata } from "next";
import { prisma } from "@/server/db";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FREE_PEOPLE, TIERS, TIER_LABEL, formatMoney, rangeLabel, unitPrice } from "@/lib/billing/plans";
import { billingOverview, dpoConfig } from "@/server/billing/service";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { AddSeatsForm, PlanPicker, QuoteForm, RenewalForm } from "./billing-forms";

export const metadata: Metadata = { title: "Plan and billing" };

const STATUS_TONE = { OPEN: "text-warning", PAID: "text-positive", VOID: "text-ink-muted" } as const;
const STATUS_LABEL = { OPEN: "To pay", PAID: "Paid", VOID: "Cancelled" } as const;

export default async function BillingPage() {
  const { actor, organisation } = await requireMember();
  const { sub, people, prices, invoices, summary } = await billingOverview(organisation.id);
  const manage = can(actor, "manageBilling");
  const online = !!dpoConfig();
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: organisation.timeZone });
  const paid = sub.status === "ACTIVE" || sub.status === "PAST_DUE";
  const partner = sub.billedBy === "PARTNER";
  const partnerName = organisation.partnerId ? ((await prisma.partner.findUnique({ where: { id: organisation.partnerId }, select: { name: true } }))?.name ?? null) : null;
  const details = { billingName: sub.billingName, billingEmail: sub.billingEmail, billingAddress: sub.billingAddress, taxNumber: sub.taxNumber };
  const openInvoice = invoices.find((i) => i.status === "OPEN");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="Plan and billing" />

      <Card>
        <CardHeader title={partner && partnerName ? `${TIER_LABEL[sub.tier]}, through ${partnerName}` : summary.label}>
          {partner
            ? sub.status === "CANCELLED"
              ? `Your plan through ${partnerName ?? "your provider"} has ended. You can still sign in and look, but Tshaeno no longer syncs your directory or applies signatures. To start again, ask ${partnerName ?? "them"}.`
              : `${partnerName ?? "Your provider"} bills you for Tshaeno, for ${sub.seats} ${sub.seats === 1 ? "person" : "people"}. To change your plan, ask them.`
            : sub.status === "TRIALING"
              ? `Everything works during the trial. ${summary.trialDaysLeft === 0 ? "It ends today." : `${summary.trialDaysLeft} ${summary.trialDaysLeft === 1 ? "day" : "days"} left, until ${day.format(sub.trialEndsAt!)}.`} After that, up to ${FREE_PEOPLE} people keep their signatures for free, with a small Signature by Tshaeno link.`
              : sub.status === "FREE"
                ? `Free for up to ${FREE_PEOPLE} people. Signatures carry a small Signature by Tshaeno link, which a paid plan removes.`
                : sub.status === "PAST_DUE"
                  ? `Your plan ended on ${day.format(sub.periodEnd!)} and the renewal isn't paid yet. Everything keeps working for now.`
                  : `${sub.seats} people, until ${day.format(sub.periodEnd!)}. It renews then.`}
        </CardHeader>
        <dl className="grid gap-4 text-callout sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">People in your directory</dt>
            <dd className="text-title-2 text-ink tabular-nums">{people}</dd>
          </div>
          {paid ? (
            <div>
              <dt className="text-ink-muted">People paid for</dt>
              <dd className="text-title-2 text-ink tabular-nums">{sub.seats}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-ink-muted">Signature by Tshaeno link</dt>
            <dd className="text-headline text-ink">{summary.badge ? "Shown" : "Not shown"}</dd>
          </div>
        </dl>
        {summary.over > 0 ? (
          <Alert tone="warning" className="mt-5">
            {sub.status === "FREE"
              ? `You have ${people} people, more than the free plan's ${FREE_PEOPLE}. Their signatures still work; choose a plan to cover everyone.`
              : `You have ${summary.over} more ${summary.over === 1 ? "person" : "people"} than you pay for. Their signatures still work; add them below or at renewal.`}
          </Alert>
        ) : null}
        {openInvoice ? (
          <Alert tone="info" className="mt-5">
            Invoice {openInvoice.number} for {formatMoney(openInvoice.totalMinor, openInvoice.currency)} is waiting to be paid.{" "}
            <Link href={`/app/billing/invoices/${openInvoice.id}`} className="font-semibold underline">
              Open it
            </Link>
          </Alert>
        ) : null}
      </Card>

      {!partner && manage && !paid ? (
        <Card>
          <CardHeader title="Choose a plan">You pay per person per month, by the size of your team. Yearly billing gives you two months free.</CardHeader>
          <PlanPicker prices={prices} people={people} currency={sub.currency} customMinor={sub.customMinor} online={online} details={details} />
        </Card>
      ) : null}

      {!partner && manage && sub.status === "ACTIVE" ? (
        <Card>
          <CardHeader title="Add people">You pay for the rest of this period only. To pay for fewer people, change it for your renewal below.</CardHeader>
          <AddSeatsForm seats={sub.seats} online={online} />
        </Card>
      ) : null}

      {!partner && manage ? (
        <Card>
          <CardHeader title={paid ? "Your renewal and invoices" : "Invoice details"}>
            {paid ? "How your next period is billed, and what goes on your invoices." : "What goes on your invoices."}
          </CardHeader>
          <RenewalForm interval={sub.interval} currency={sub.currency} seats={sub.renewalSeats ?? sub.seats} showBadge={sub.showBadge} paid={paid} details={details} />
        </Card>
      ) : null}

      {!partner ? (
        <Card>
          <CardHeader title="Prices">Per person per month, in {sub.currency}. Yearly prices shown first.</CardHeader>
          <ul className="grid gap-3 sm:grid-cols-4">
            {TIERS.map((t) => {
              const annual = unitPrice(prices, t, sub.currency, "ANNUAL", t === "ENTERPRISE" ? sub.customMinor : null);
              const monthly = unitPrice(prices, t, sub.currency, "MONTHLY", t === "ENTERPRISE" ? sub.customMinor : null);
              return (
                <li key={t} className="rounded-md border border-border px-4 py-3">
                  <p className="font-semibold text-ink">{TIER_LABEL[t]}</p>
                  <p className="text-callout text-ink-muted">{rangeLabel(t)}</p>
                  <p className="mt-2 text-headline text-ink tabular-nums">{annual != null ? formatMoney(annual, sub.currency) : "By quote"}</p>
                  {monthly != null ? <p className="text-callout text-ink-muted">{formatMoney(monthly, sub.currency)} billed monthly</p> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {!partner && manage && !paid ? (
        <Card>
          <CardHeader title="1,000 people or more">We price Enterprise plans for you, with help to roll out across your organisation.</CardHeader>
          <QuoteForm people={people} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Invoices" />
        {invoices.length === 0 ? (
          <p className="text-callout text-ink-muted">No invoices yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link href={`/app/billing/invoices/${i.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-3 hover:bg-surface-2">
                  <span className="font-semibold text-ink tabular-nums">{i.number}</span>
                  <span className="text-callout text-ink-muted">{day.format(i.issuedAt)}</span>
                  <span className="flex-1 text-right text-ink tabular-nums">{formatMoney(i.totalMinor, i.currency)}</span>
                  <span className={`w-[72px] text-right text-callout font-semibold ${STATUS_TONE[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

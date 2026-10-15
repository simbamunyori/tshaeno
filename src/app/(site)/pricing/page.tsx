import { Check } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  CURRENCIES,
  CURRENCY_LABEL,
  FREE_PEOPLE,
  TIER_LABEL,
  TRIAL_DAYS,
  annualSaving,
  formatMoney,
  rangeLabel,
  type BillingInterval,
  type Currency,
  type PlanTier,
} from "@/lib/billing/plans";
import { visitorCurrency } from "@/lib/site/currency";
import { publicPrices, salesEmail } from "@/server/site";
import { Estimator } from "./estimator";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free for up to ${FREE_PEOPLE} people. Paid plans are priced per person, in pula, rand or US dollars, and get cheaper as you grow.`,
};
export const dynamic = "force-dynamic";

const PAID: PlanTier[] = ["STARTER", "GROWTH", "BUSINESS"];

const INCLUDED = [
  "Gmail and Outlook, on every device",
  "Directory sync with Google and Microsoft",
  "Every template, and the studio",
  "Signatures by department, office or group",
  "Campaign banners and click reports",
  "Drafting and brand checks with Claude",
];

const SHORT: Record<Currency, string> = { BWP: "pula", ZAR: "rand", USD: "US dollars" };

function link(currency: Currency, interval: BillingInterval) {
  const q = new URLSearchParams({ currency });
  if (interval === "ANNUAL") q.set("billing", "annual");
  return `/pricing?${q}`;
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ currency?: string; billing?: string }> }) {
  const sp = await searchParams;
  const choice = visitorCurrency(await headers(), sp.currency);
  const currency = choice.currency;
  const interval: BillingInterval = sp.billing === "annual" ? "ANNUAL" : "MONTHLY";
  const prices = await publicPrices(currency);
  const sales = salesEmail();
  const priceOf = (t: PlanTier) => prices.find((p) => p.tier === t) ?? null;
  const best = Math.max(0, ...prices.map(annualSaving));
  const toggle = (active: boolean) => cn("flex h-9 items-center rounded-md px-3 text-callout", active ? "bg-surface-1 font-semibold text-ink shadow-sm" : "text-ink-muted hover:text-ink");

  return (
    <>
      <Section className="pt-10 pb-10 sm:pt-16 sm:pb-12">
        <div className="flex max-w-[720px] flex-col gap-3">
          <h1 className="text-[34px] leading-[40px] font-bold tracking-[-0.03em] text-ink sm:text-[44px] sm:leading-[50px]">Simple pricing, per person</h1>
          <p className="text-[17px] leading-7 text-ink-muted">
            Every plan has every feature. You pay for the people in your directory, and the price per person drops as you grow. Start with {TRIAL_DAYS} days of
            everything, no card needed.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex rounded-lg bg-surface-2 p-1" role="group" aria-label="Billing">
            <Link href={link(currency, "MONTHLY")} className={toggle(interval === "MONTHLY")} aria-current={interval === "MONTHLY" ? "true" : undefined}>
              Monthly
            </Link>
            <Link href={link(currency, "ANNUAL")} className={toggle(interval === "ANNUAL")} aria-current={interval === "ANNUAL" ? "true" : undefined}>
              Yearly{best ? `, save up to ${best}%` : ""}
            </Link>
          </div>
          <div className="flex rounded-lg bg-surface-2 p-1" role="group" aria-label="Currency">
            {CURRENCIES.map((c) => (
              <Link key={c} href={link(c, interval)} className={toggle(c === currency)} aria-current={c === currency ? "true" : undefined} title={CURRENCY_LABEL[c]}>
                {c}
              </Link>
            ))}
          </div>
          <p className="text-callout text-ink-muted">
            {choice.source === "chosen" ? `Prices in ${SHORT[currency]}.` : `Prices in ${SHORT[currency]}, based on where you are.`}
          </p>
        </div>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <li className="flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-6">
            <div>
              <h2 className="text-headline text-ink">Free</h2>
              <p className="text-callout text-ink-muted">Up to {FREE_PEOPLE} people</p>
            </div>
            <p className="text-[32px] leading-[38px] font-bold tracking-[-0.02em] text-ink">{formatMoney(0, currency)}</p>
            <p className="text-callout text-ink-muted">Everything works. Signatures carry a small Signature by Tshaeno link.</p>
            <Button asChild variant="secondary" className="mt-auto">
              <Link href="/sign-up">Start free</Link>
            </Button>
          </li>
          {PAID.map((t) => {
            const p = priceOf(t);
            const unit = p ? (interval === "ANNUAL" ? p.annualMinor : p.monthlyMinor) : null;
            return (
              <li key={t} className={cn("flex flex-col gap-4 rounded-lg border bg-surface-1 p-6", t === "GROWTH" ? "border-brand ring-1 ring-brand" : "border-border")}>
                <div>
                  <h2 className="flex items-center justify-between gap-2 text-headline text-ink">
                    {TIER_LABEL[t]}
                    {t === "GROWTH" ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-caption font-semibold text-link">Most teams</span> : null}
                  </h2>
                  <p className="text-callout text-ink-muted">{rangeLabel(t)}</p>
                </div>
                {unit !== null ? (
                  <p className="flex flex-col">
                    <span className="text-[32px] leading-[38px] font-bold tracking-[-0.02em] text-ink">{formatMoney(unit, currency)}</span>
                    <span className="text-callout text-ink-muted">a person a month{interval === "ANNUAL" ? ", billed yearly" : ""}</span>
                  </p>
                ) : (
                  <p className="text-body text-ink-muted">Ask us for a price in {SHORT[currency]}.</p>
                )}
                <p className="text-callout text-ink-muted">No Tshaeno link in signatures.</p>
                <Button asChild variant={t === "GROWTH" ? "primary" : "secondary"} className="mt-auto">
                  <Link href="/sign-up">Start the free trial</Link>
                </Button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-headline text-ink">{TIER_LABEL.ENTERPRISE}</h2>
            <p className="text-callout text-ink-muted">For {rangeLabel("ENTERPRISE")}, priced by quote, with invoicing to suit your finance team.</p>
          </div>
          <Button asChild variant="secondary">
            {sales ? <a href={`mailto:${sales}?subject=${encodeURIComponent("Tshaeno Enterprise")}`}>Ask for a quote</a> : <Link href="/sign-up">Start, then ask for a quote</Link>}
          </Button>
        </div>
      </Section>

      <Section className="bg-surface-1" inner="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="mb-5 text-title-2 text-ink">Every plan includes</h2>
          <ul className="flex flex-col gap-3">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-3 text-body text-ink">
                <Check aria-hidden className="mt-1 size-4 shrink-0 text-positive" />
                {i}
              </li>
            ))}
          </ul>
        </div>
        <Estimator prices={prices} currency={currency} interval={interval} />
      </Section>

      <Section aria-labelledby="faq" inner="max-w-[760px]">
        <h2 id="faq" className="mb-6 text-title-2 text-ink">
          Questions
        </h2>
        <dl className="flex flex-col divide-y divide-border border-y border-border">
          {[
            ["Who counts as a person?", "Everyone in your Tshaeno directory who is active. People who leave stop counting as soon as your directory syncs."],
            [
              "What happens after the trial?",
              `Nothing stops working. Up to ${FREE_PEOPLE} people keep their signatures for free, with the small Tshaeno link. Choose a plan any time to remove it or cover more people.`,
            ],
            ["How do I pay?", "By card online, or by bank transfer against an invoice. Tax is added where it applies."],
            ["What if we add people part way through a year?", "You pay for the new people for the time left in your plan, nothing more."],
            [
              "Can we pay through Fourth Generation Technologies?",
              "Yes. Add Tshaeno from the Fourth Generation marketplace and it appears on the invoice you already get. Fourth Generation email customers get Starter free.",
            ],
          ].map(([q, a]) => (
            <div key={q} className="py-5">
              <dt className="text-headline text-ink">{q}</dt>
              <dd className="mt-1 text-body text-ink-muted">
                {a}
                {q.includes("Fourth Generation") ? (
                  <>
                    {" "}
                    <Link href="/fourth-generation" className="font-semibold text-link hover:underline">
                      How it works
                    </Link>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

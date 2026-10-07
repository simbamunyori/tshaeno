"use client";

import { useId, useState } from "react";
import { FREE_PEOPLE, TIER_LABEL, formatMoney, tierFor, unitPrice, type BillingInterval, type Currency, type Price } from "@/lib/billing/plans";

/** What a team of a given size would pay, worked out as the visitor types. */
export function Estimator({ prices, currency, interval }: { prices: Price[]; currency: Currency; interval: BillingInterval }) {
  const id = useId();
  const [raw, setRaw] = useState("25");
  const people = Math.min(100_000, Math.max(0, Math.floor(Number(raw) || 0)));
  const tier = tierFor(Math.max(1, people));
  const unit = tier === "ENTERPRISE" ? null : unitPrice(prices, tier, currency, interval);

  let result: string;
  let detail: string;
  if (people < 1) {
    result = "";
    detail = "Enter how many people send email.";
  } else if (unit === null) {
    result = "By quote";
    detail = tier === "ENTERPRISE" ? `${TIER_LABEL.ENTERPRISE} is priced for your organisation.` : "Ask us for a price in this currency.";
  } else {
    const monthly = unit * people;
    result = `${formatMoney(monthly, currency)} a month`;
    detail =
      interval === "ANNUAL"
        ? `${TIER_LABEL[tier]}, ${formatMoney(unit, currency)} a person a month, ${formatMoney(monthly * 12, currency)} billed yearly.`
        : `${TIER_LABEL[tier]}, ${formatMoney(unit, currency)} a person a month.`;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-0 p-6">
      <h2 className="text-title-2 text-ink">What would it cost us?</h2>
      <label htmlFor={id} className="text-callout font-semibold text-ink">
        People who send email
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={100000}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="h-12 w-40 rounded-md border border-border-strong bg-surface-1 px-3 text-title-2 text-ink"
      />
      <output htmlFor={id} aria-live="polite" className="flex flex-col gap-1">
        <span className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-ink">{result}</span>
        <span className="text-callout text-ink-muted">{detail}</span>
        {people >= 1 && people <= FREE_PEOPLE ? <span className="text-callout text-ink-muted">Or free, with the small Tshaeno link in signatures.</span> : null}
      </output>
    </div>
  );
}

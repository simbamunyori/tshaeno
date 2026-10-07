"use client";

import { useActionState, useState } from "react";
import { ActionForm, type FormState } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextField, inputClass } from "@/components/ui/field";
import { SelectField } from "@/components/ui/inputs";
import {
  CURRENCIES,
  CURRENCY_LABEL,
  TIER_LABEL,
  annualSaving,
  formatMoney,
  periodPrice,
  rangeLabel,
  tierFor,
  unitPrice,
  type BillingInterval,
  type Currency,
  type Price,
} from "@/lib/billing/plans";
import { addSeatsAction, checkoutAction, payOnlineAction, quoteAction, renewalAction } from "./actions";

export interface BillingDetails {
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  taxNumber: string;
}

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: `${c}, ${CURRENCY_LABEL[c]}` }));

function BillingFields({ details, errors }: { details: BillingDetails; errors: Record<string, string> }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-callout font-semibold text-ink">On the invoice</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="billingName" label="Name" defaultValue={details.billingName} hint="Your organisation's legal name, if different." error={errors.billingName} />
        <TextField id="billingEmail" label="Email for invoices" type="email" defaultValue={details.billingEmail} hint="Leave empty to send them to the owners." error={errors.billingEmail} />
        <TextField id="billingAddress" label="Address" defaultValue={details.billingAddress} error={errors.billingAddress} />
        <TextField id="taxNumber" label="Tax number" defaultValue={details.taxNumber} hint="Optional." error={errors.taxNumber} />
      </div>
    </fieldset>
  );
}

function MethodField({ online, name = "method" }: { online: boolean; name?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-callout font-semibold text-ink">How you&apos;ll pay</legend>
      {online ? (
        <label className="flex items-start gap-3 text-body text-ink">
          <input type="radio" name={name} value="DPO" defaultChecked className="mt-1 size-4 accent-[var(--brand)]" />
          <span>
            Online now, by card or mobile money <span className="text-callout text-ink-muted">through DPO Pay</span>
          </span>
        </label>
      ) : null}
      <label className="flex items-start gap-3 text-body text-ink">
        <input type="radio" name={name} value="BANK_TRANSFER" defaultChecked={!online} className="mt-1 size-4 accent-[var(--brand)]" />
        <span>
          Bank transfer <span className="text-callout text-ink-muted">your plan starts when the money arrives</span>
        </span>
      </label>
    </fieldset>
  );
}

/** Choose seats, billing and currency, with the price worked out as they change. */
export function PlanPicker({
  prices,
  people,
  currency: initialCurrency,
  customMinor,
  online,
  details,
}: {
  prices: Price[];
  people: number;
  currency: Currency;
  customMinor: number | null;
  online: boolean;
  details: BillingDetails;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(checkoutAction, {});
  const [seats, setSeats] = useState(Math.max(2, people));
  const [interval, setInterval] = useState<BillingInterval>("ANNUAL");
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const tier = tierFor(seats);
  const unit = unitPrice(prices, tier, currency, interval, customMinor);
  const monthly = unitPrice(prices, tier, currency, "MONTHLY", customMinor);
  const p = prices.find((x) => x.tier === tier && x.currency === currency);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={run} className="flex flex-col gap-6">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="seats" label="People" hint={`You have ${people} in your directory.`} error={errors.seats}>
          {(d, invalid) => (
            <input
              id="seats"
              name="seats"
              type="number"
              inputMode="numeric"
              min={Math.max(1, people)}
              max={100000}
              value={seats}
              onChange={(e) => setSeats(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              aria-describedby={d}
              aria-invalid={invalid || undefined}
              className={inputClass}
            />
          )}
        </Field>
        <SelectField
          id="interval"
          label="Billing"
          value={interval}
          onChange={(e) => setInterval(e.target.value as BillingInterval)}
          options={[
            { value: "ANNUAL", label: p && !customMinor ? `Yearly, save ${annualSaving(p)}%` : "Yearly" },
            { value: "MONTHLY", label: "Monthly" },
          ]}
        />
        <SelectField id="currency" label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} options={currencyOptions} error={errors.currency} />
      </div>

      <div className="rounded-md bg-surface-2 px-4 py-4" aria-live="polite">
        {unit == null ? (
          <p className="text-body text-ink">
            <strong>{TIER_LABEL[tier]}</strong> is for {rangeLabel(tier)} and is priced by quote. Ask us below.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-body text-ink">
              <strong>{TIER_LABEL[tier]}</strong>, {formatMoney(unit, currency)} a person a month
              {interval === "ANNUAL" && monthly && monthly > unit ? <span className="text-ink-muted"> instead of {formatMoney(monthly, currency)}</span> : null}
            </p>
            <p className="text-title-2 font-semibold text-ink tabular-nums">
              {formatMoney(periodPrice(unit, seats, interval), currency)} <span className="text-callout font-normal text-ink-muted">{interval === "ANNUAL" ? "a year" : "a month"}</span>
            </p>
          </div>
        )}
      </div>

      <MethodField online={online} />
      <BillingFields details={details} errors={errors} />
      <Button type="submit" size="lg" disabled={pending || unit == null || seats < Math.max(1, people)} className="self-start">
        {pending ? "One moment…" : "Continue to payment"}
      </Button>
    </form>
  );
}

export function AddSeatsForm({ seats, online }: { seats: number; online: boolean }) {
  return (
    <ActionForm action={addSeatsAction} submit="Continue to payment" pending="One moment…">
      {(errors) => (
        <>
          <TextField id="seats" label="People to pay for" type="number" inputMode="numeric" min={seats + 1} defaultValue={seats + 5} error={errors.seats} className="sm:max-w-[240px]" />
          <MethodField online={online} />
        </>
      )}
    </ActionForm>
  );
}

export function RenewalForm({
  interval,
  currency,
  seats,
  showBadge,
  paid,
  details,
}: {
  interval: BillingInterval;
  currency: Currency;
  seats: number;
  showBadge: boolean;
  paid: boolean;
  details: BillingDetails;
}) {
  return (
    <ActionForm action={renewalAction} submit="Save">
      {(errors) => (
        <>
          {paid ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField id="seats" label="People at renewal" type="number" inputMode="numeric" min={1} defaultValue={seats} error={errors.seats} hint="Never fewer than are in your directory then." />
              <SelectField
                id="interval"
                label="Billing"
                defaultValue={interval}
                options={[
                  { value: "ANNUAL", label: "Yearly" },
                  { value: "MONTHLY", label: "Monthly" },
                ]}
              />
              <SelectField id="currency" label="Currency" defaultValue={currency} options={currencyOptions} error={errors.currency} />
            </div>
          ) : (
            <>
              <input type="hidden" name="interval" value={interval} />
              <input type="hidden" name="currency" value={currency} />
            </>
          )}
          <BillingFields details={details} errors={errors} />
          {paid ? (
            <label className="flex items-start gap-3 text-body text-ink">
              <input type="checkbox" name="showBadge" defaultChecked={showBadge} className="mt-1 size-4 accent-[var(--brand)]" />
              <span>
                Keep the small Signature by Tshaeno link under signatures <span className="text-callout text-ink-muted">Off by default on paid plans.</span>
              </span>
            </label>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}

export function QuoteForm({ people }: { people: number }) {
  return (
    <ActionForm action={quoteAction} submit="Ask for a quote" variant="secondary" pending="Sending…">
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <TextField id="people" label="About how many people" type="number" inputMode="numeric" min={1} defaultValue={Math.max(1000, people)} error={errors.people} />
          <TextField id="note" label="Anything we should know" hint="Optional." maxLength={1000} />
        </div>
      )}
    </ActionForm>
  );
}

export function PayOnlineButton({ id }: { id: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(payOnlineAction, {});
  return (
    <form action={run} className="flex flex-col gap-3 print:hidden">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "One moment…" : "Pay online"}
      </Button>
    </form>
  );
}

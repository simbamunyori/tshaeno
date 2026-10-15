"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/ui/action-form";
import { requestContext } from "@/server/auth/next";
import { addSeats, changeRenewal, checkout, payOnline, realBillingDeps, requestQuote } from "@/server/billing/service";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { CURRENCIES, type BillingInterval, type Currency } from "@/lib/billing/plans";

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress };
}

const s = (form: FormData, k: string) => String(form.get(k) ?? "");
const interval = (form: FormData): BillingInterval => (s(form, "interval") === "ANNUAL" ? "ANNUAL" : "MONTHLY");
const currency = (form: FormData): Currency => {
  const c = s(form, "currency") as Currency;
  if (!CURRENCIES.includes(c)) throw new DomainError("invalid", "Choose a currency.", "currency");
  return c;
};
const method = (form: FormData) => (s(form, "method") === "DPO" ? ("DPO" as const) : ("BANK_TRANSFER" as const));
const billing = (form: FormData) => ({ billingName: s(form, "billingName"), billingEmail: s(form, "billingEmail"), billingAddress: s(form, "billingAddress"), taxNumber: s(form, "taxNumber") });

function failure(e: unknown): FormState {
  if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message } } : { error: e.message };
  throw e;
}

/** Sends them to pay: DPO's page, or the invoice with bank details. */
function toPayment(outcome: { invoiceId: string; payUrl: string | null }): never {
  redirect(outcome.payUrl ?? `/app/billing/invoices/${outcome.invoiceId}?new=1`);
}

export async function checkoutAction(_prev: FormState, form: FormData): Promise<FormState> {
  let outcome;
  try {
    outcome = await checkout(await ctx(), { seats: Number(s(form, "seats")), interval: interval(form), currency: currency(form), method: method(form), ...billing(form) }, realBillingDeps());
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/billing");
  toPayment(outcome);
}

export async function addSeatsAction(_prev: FormState, form: FormData): Promise<FormState> {
  let outcome;
  try {
    outcome = await addSeats(await ctx(), Number(s(form, "seats")), method(form), realBillingDeps());
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/billing");
  toPayment(outcome);
}

export async function renewalAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await changeRenewal(await ctx(), { interval: interval(form), currency: currency(form), seats: Number(s(form, "seats") || 0), showBadge: form.get("showBadge") === "on", ...billing(form) });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/billing");
  return { ok: "Saved. Changes to how you pay take effect from your next renewal." };
}

export async function payOnlineAction(_prev: FormState, form: FormData): Promise<FormState> {
  let url;
  try {
    url = await payOnline(await ctx(), s(form, "id"), realBillingDeps());
  } catch (e) {
    return failure(e);
  }
  redirect(url);
}

export async function quoteAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await requestQuote(await ctx(), { people: Number(s(form, "people")), note: s(form, "note") });
  } catch (e) {
    return failure(e);
  }
  return { ok: "Thank you. We'll be in touch within one working day." };
}

"use server";

import { revalidatePath } from "next/cache";
import { requestContext } from "@/server/auth/next";
import { DomainError } from "@/server/org/access";
import type { FormState } from "@/components/ui/action-form";
import { CURRENCIES, TIERS, parseMoney, type Currency, type PlanTier } from "@/lib/billing/plans";
import { extendTrial, recordBankPayment, setCustomPrice, setOrganisationStatus, setPrice, voidInvoice } from "@/server/platform/service";
import { requireStaff } from "./staff";

export interface StatusState {
  error?: string;
}

export async function setStatusAction(_prev: StatusState, form: FormData): Promise<StatusState> {
  const staff = await requireStaff();
  const id = String(form.get("id"));
  const status = form.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  try {
    await setOrganisationStatus(staff, id, status, String(form.get("reason") ?? ""), (await requestContext()).ipAddress);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/organisations/${id}`);
  return {};
}

// ─── Billing ───────────────────────────────────────────────────────

const s = (form: FormData, k: string) => String(form.get(k) ?? "");

function failure(e: unknown): FormState {
  if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message } } : { error: e.message };
  throw e;
}

export async function setPriceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const tier = s(form, "tier") as PlanTier;
  const currency = s(form, "currency") as Currency;
  if (!TIERS.includes(tier) || !CURRENCIES.includes(currency)) return { error: "Choose a band and a currency." };
  const monthlyMinor = parseMoney(s(form, "monthly"));
  const annualMinor = parseMoney(s(form, "annual"));
  if (monthlyMinor == null) return { fieldErrors: { monthly: "Enter a price, like 1.50." } };
  if (annualMinor == null) return { fieldErrors: { annual: "Enter a price, like 1.25." } };
  try {
    await setPrice(staff, { tier, currency, monthlyMinor, annualMinor }, (await requestContext()).ipAddress);
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/admin/prices");
  return { ok: "Saved. New invoices use this price; ones already issued don't change." };
}

export async function bankPaymentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  try {
    await recordBankPayment(staff, s(form, "id"), s(form, "reference"), (await requestContext()).ipAddress);
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/admin/organisations/${s(form, "organisationId")}`);
  return { ok: "Recorded. Their plan is updated and they've been emailed a receipt." };
}

export async function voidInvoiceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  try {
    await voidInvoice(staff, s(form, "id"), s(form, "reason"), (await requestContext()).ipAddress);
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/admin/organisations/${s(form, "organisationId")}`);
  return { ok: "Cancelled." };
}

export async function extendTrialAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  try {
    await extendTrial(staff, s(form, "organisationId"), Number(s(form, "days")), (await requestContext()).ipAddress);
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/admin/organisations/${s(form, "organisationId")}`);
  return { ok: "Trial extended." };
}

export async function customPriceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const raw = s(form, "price").trim();
  const minor = raw ? parseMoney(raw) : null;
  if (raw && minor == null) return { fieldErrors: { price: "Enter a price, like 0.80, or leave it empty." } };
  try {
    await setCustomPrice(staff, s(form, "organisationId"), minor, (await requestContext()).ipAddress);
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/admin/organisations/${s(form, "organisationId")}`);
  return { ok: minor == null ? "They use the price list again." : "Saved. Their next invoice uses this price." };
}

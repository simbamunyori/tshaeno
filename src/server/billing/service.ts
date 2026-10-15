import type { Invoice, InvoiceKind, Organisation, PaymentMethod, Prisma, PrismaClient, Subscription } from "@prisma/client";
import { asSystem, asTenant, type Tx } from "@/server/db";
import { env } from "@/server/env";
import { looksLikeEmail, normaliseEmail } from "@/server/auth/service";
import { ProviderError, type Fetch } from "@/server/connections/http";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import {
  DAY,
  FREE_PEOPLE,
  GRACE_DAYS,
  PAYMENT_TERMS_DAYS,
  RENEWAL_NOTICE_DAYS,
  TIER_LABEL,
  formatMoney,
  monthsIn,
  periodEndFrom,
  periodPrice,
  prorate,
  tierFor,
  unitPrice,
  type BillingInterval,
  type Currency,
  type Price,
} from "@/lib/billing/plans";
import { showsBadge } from "./badge";
import { startTrial } from "./trial";
import { DPO_API_URL, DPO_PAY_URL, checkPayment, createPayment, type DpoConfig } from "./dpo";

/**
 * Plans, invoices and payments for organisations that pay Tshaeno
 * directly. Organisations billed by a partner (S5) are left alone here.
 *
 * Nothing in billing ever stops a signature: a lapsed plan drops to the
 * free option, which adds a small "Signature by Tshaeno" link.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });

export interface BillingDeps {
  /** DPO Pay, when this server takes online payments. */
  dpo: DpoConfig | null;
  fetch?: Fetch;
  /** The app's public origin, for links. */
  origin: string;
  now?: Date;
  /** Limits the billing round to these organisations. For tests. */
  only?: string[];
}

export function dpoConfig(): DpoConfig | null {
  const e = env();
  if (!e.DPO_COMPANY_TOKEN || !e.DPO_SERVICE_TYPE) return null;
  return { companyToken: e.DPO_COMPANY_TOKEN, serviceType: e.DPO_SERVICE_TYPE, apiUrl: e.DPO_API_URL ?? DPO_API_URL, payUrl: e.DPO_PAY_URL ?? DPO_PAY_URL };
}

export function realBillingDeps(): BillingDeps {
  return { dpo: dpoConfig(), origin: env().APP_URL.replace(/\/$/, "") };
}

// ─── Prices ────────────────────────────────────────────────────────

export async function currentPrices(tx: Tx): Promise<Price[]> {
  return tx.planPrice.findMany({ select: { tier: true, currency: true, monthlyMinor: true, annualMinor: true } });
}

// ─── Subscriptions ─────────────────────────────────────────────────

export { showsBadge, startTrial };

/** The organisation's subscription, made if an older organisation has none. Works inside its tenant scope. */
export async function subscriptionOf(tx: Tx, organisationId: string): Promise<Subscription> {
  const sub = await tx.subscription.findUnique({ where: { organisationId } });
  if (sub) return sub;
  const org = await tx.organisation.findUniqueOrThrow({ where: { id: organisationId }, select: { id: true, timeZone: true } });
  return startTrial(tx, org);
}

export interface PlanSummary {
  status: Subscription["status"];
  /** What to call the plan right now. */
  label: string;
  badge: boolean;
  people: number;
  /** People beyond what the plan covers. */
  over: number;
  trialDaysLeft: number | null;
}

export function summarise(sub: Subscription, people: number, now = new Date()): PlanSummary {
  const trialDaysLeft = sub.status === "TRIALING" && sub.trialEndsAt ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / DAY)) : null;
  const label =
    sub.billedBy === "PARTNER"
      ? `${TIER_LABEL[sub.tier]}, billed by your provider`
      : sub.status === "TRIALING"
        ? "Free trial"
        : sub.status === "FREE"
          ? "Starter, free"
          : `${TIER_LABEL[sub.tier]}, ${sub.interval === "ANNUAL" ? "billed yearly" : "billed monthly"}`;
  const covered = sub.status === "FREE" ? FREE_PEOPLE : sub.status === "TRIALING" || sub.billedBy === "PARTNER" ? Infinity : sub.seats;
  return { status: sub.status, label, badge: showsBadge(sub), people, over: Math.max(0, people - covered), trialDaysLeft };
}

export const activePeople = (tx: Tx) => tx.person.count({ where: { active: true } });

// ─── Invoices ──────────────────────────────────────────────────────

/** TSH-2026-00001. Numbers never repeat, across all organisations. */
export async function nextInvoiceNumber(tx: Tx, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const [row] = await tx.$queryRaw<{ n: number }[]>`
    INSERT INTO "InvoiceCounter" ("year", "next") VALUES (${year}, 2)
    ON CONFLICT ("year") DO UPDATE SET "next" = "InvoiceCounter"."next" + 1
    RETURNING "next" - 1 AS n`;
  return `TSH-${year}-${String(row.n).padStart(5, "0")}`;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitMinor: number;
  amountMinor: number;
}

export interface BillTo {
  name: string;
  email: string;
  address: string;
  taxNumber: string;
}

function billTo(sub: Subscription, org: Pick<Organisation, "name">): BillTo {
  return { name: sub.billingName || org.name, email: sub.billingEmail, address: sub.billingAddress, taxNumber: sub.taxNumber };
}

function totals(lines: InvoiceLine[]) {
  const subtotalMinor = lines.reduce((n, l) => n + l.amountMinor, 0);
  const taxMinor = Math.round((subtotalMinor * env().TAX_PERCENT) / 100);
  return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(d);

async function issueInvoice(
  tx: Tx,
  input: {
    organisationId: string;
    kind: InvoiceKind;
    method: PaymentMethod;
    sub: Subscription;
    org: Pick<Organisation, "name">;
    currency: Currency;
    interval: BillingInterval;
    seats: number;
    lines: InvoiceLine[];
    periodStart: Date;
    periodEnd: Date;
    dueAt: Date;
    now: Date;
  },
): Promise<Invoice> {
  const invoice = await tx.invoice.create({
    data: {
      organisationId: input.organisationId,
      number: await nextInvoiceNumber(tx, input.now),
      kind: input.kind,
      method: input.method,
      currency: input.currency,
      tier: tierFor(input.seats),
      interval: input.interval,
      seats: input.seats,
      lines: input.lines as unknown as Prisma.InputJsonValue,
      ...totals(input.lines),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      billTo: billTo(input.sub, input.org) as unknown as Prisma.InputJsonValue,
      issuedAt: input.now,
      dueAt: input.dueAt,
    },
  });
  await queueBillingEmail(tx, input.sub, "invoice", { invoiceId: invoice.id });
  return invoice;
}

/** Who billing emails go to: the billing contact, else the owners. */
async function billingAddresses(tx: Tx, sub: Subscription): Promise<string[]> {
  if (sub.billingEmail) return [sub.billingEmail];
  const owners = await tx.membership.findMany({ where: { organisationId: sub.organisationId, role: "OWNER", active: true }, include: { user: { select: { email: true } } } });
  return owners.map((o) => o.user.email);
}

async function queueBillingEmail(tx: Tx, sub: Subscription, kind: string, payload: Record<string, string>) {
  const to = await billingAddresses(tx, sub);
  if (to.length) await tx.outboundEmail.createMany({ data: to.map((toAddress) => ({ kind, toAddress, payload })) });
}

function lineFor(seats: number, unitMinor: number, interval: BillingInterval, currency: Currency, periodStart: Date, periodEnd: Date): InvoiceLine {
  const tier = TIER_LABEL[tierFor(seats)];
  const per = `${formatMoney(unitMinor, currency)} a person a month`;
  return {
    description: `Tshaeno ${tier}, ${seats} ${seats === 1 ? "person" : "people"}, ${day(periodStart)} to ${day(periodEnd)} (${per}${interval === "ANNUAL" ? ", billed yearly" : ""})`,
    quantity: seats * monthsIn(interval),
    unitMinor,
    amountMinor: periodPrice(unitMinor, seats, interval),
  };
}

// ─── Checkout ──────────────────────────────────────────────────────

export interface CheckoutInput {
  seats: number;
  interval: BillingInterval;
  currency: Currency;
  method: PaymentMethod;
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  taxNumber: string;
}

export type CheckoutOutcome = { invoiceId: string; payUrl: string | null };

function cleanBilling(input: Pick<CheckoutInput, "billingName" | "billingEmail" | "billingAddress" | "taxNumber">) {
  const billingEmail = normaliseEmail(input.billingEmail ?? "");
  if (billingEmail && !looksLikeEmail(billingEmail)) throw new DomainError("invalid", "Enter a valid email for invoices.", "billingEmail");
  return {
    billingName: (input.billingName ?? "").trim().slice(0, 120),
    billingEmail,
    billingAddress: (input.billingAddress ?? "").trim().slice(0, 400),
    taxNumber: (input.taxNumber ?? "").trim().slice(0, 40),
  };
}

/**
 * Starts a paid plan: an invoice for the first period, payable online
 * through DPO Pay or by bank transfer. The plan starts when it is paid.
 */
export async function checkout(ctx: Ctx, input: CheckoutInput, deps: BillingDeps): Promise<CheckoutOutcome> {
  assertCan(ctx.actor, "manageBilling");
  const now = deps.now ?? new Date();
  if (input.method === "DPO" && !deps.dpo) throw new DomainError("invalid", "Online payment isn't available yet. Choose bank transfer.", "method");
  const billing = cleanBilling(input);
  const invoice = await asTenant(
    ctx.organisationId,
    async (tx) => {
      const sub = await subscriptionOf(tx, ctx.organisationId);
      if (sub.billedBy === "PARTNER") throw new DomainError("conflict", "Your plan is billed by your provider. Change it with them.");
      if (sub.status === "ACTIVE" || sub.status === "PAST_DUE") throw new DomainError("conflict", "You already have a paid plan. Add people or change how you pay below.");
      const people = await activePeople(tx);
      const seats = Math.floor(input.seats);
      if (!Number.isFinite(seats) || seats < Math.max(1, people)) throw new DomainError("invalid", `Pay for at least the ${people} people in your directory.`, "seats");
      const unit = unitPrice(await currentPrices(tx), tierFor(seats), input.currency, input.interval, sub.customMinor);
      if (unit == null) throw new DomainError("invalid", "For 1,000 people or more, ask us for a quote.", "seats");
      const org = await tx.organisation.findUniqueOrThrow({ where: { id: ctx.organisationId }, select: { name: true } });
      const updated = await tx.subscription.update({ where: { id: sub.id }, data: billing });
      // One checkout at a time.
      await tx.invoice.updateMany({ where: { kind: "NEW", status: "OPEN" }, data: { status: "VOID", voidedAt: now } });
      const periodEnd = periodEndFrom(now, input.interval);
      const inv = await issueInvoice(tx, {
        organisationId: ctx.organisationId,
        kind: "NEW",
        method: input.method,
        sub: updated,
        org,
        currency: input.currency,
        interval: input.interval,
        seats,
        lines: [lineFor(seats, unit, input.interval, input.currency, now, periodEnd)],
        periodStart: now,
        periodEnd,
        dueAt: new Date(now.getTime() + PAYMENT_TERMS_DAYS * DAY),
        now,
      });
      await audit(tx, ctx.organisationId, who(ctx.actor), "billing.checkout", { type: "Invoice", id: inv.id }, { number: inv.number, seats, interval: input.interval, currency: input.currency }, ctx.ipAddress);
      return inv;
    },
    ctx.db,
  );
  const payUrl = input.method === "DPO" ? await payOnline(ctx, invoice.id, deps) : null;
  return { invoiceId: invoice.id, payUrl };
}

/** Adds people part way through a paid period, for a share of the price. */
export async function addSeats(ctx: Ctx, seatsInput: number, method: PaymentMethod, deps: BillingDeps): Promise<CheckoutOutcome> {
  assertCan(ctx.actor, "manageBilling");
  const now = deps.now ?? new Date();
  if (method === "DPO" && !deps.dpo) throw new DomainError("invalid", "Online payment isn't available yet. Choose bank transfer.", "method");
  const invoice = await asTenant(
    ctx.organisationId,
    async (tx) => {
      const sub = await subscriptionOf(tx, ctx.organisationId);
      if (sub.status !== "ACTIVE" || !sub.periodStart || !sub.periodEnd) throw new DomainError("conflict", "Adding people needs a paid plan.");
      const seats = Math.floor(seatsInput);
      if (!Number.isFinite(seats) || seats <= sub.seats) throw new DomainError("invalid", `Enter more than the ${sub.seats} people you pay for now. Fewer takes effect at renewal.`, "seats");
      const unit = unitPrice(await currentPrices(tx), tierFor(seats), sub.currency, sub.interval, sub.customMinor);
      if (unit == null) throw new DomainError("invalid", "For 1,000 people or more, ask us for a quote.", "seats");
      const extra = seats - sub.seats;
      const amount = prorate(extra, unit, sub.interval, sub.periodStart, sub.periodEnd, now);
      const org = await tx.organisation.findUniqueOrThrow({ where: { id: ctx.organisationId }, select: { name: true } });
      await tx.invoice.updateMany({ where: { kind: "SEATS", status: "OPEN" }, data: { status: "VOID", voidedAt: now } });
      const inv = await issueInvoice(tx, {
        organisationId: ctx.organisationId,
        kind: "SEATS",
        method,
        sub,
        org,
        currency: sub.currency,
        interval: sub.interval,
        seats,
        lines: [
          {
            description: `${extra} more ${extra === 1 ? "person" : "people"} on Tshaeno ${TIER_LABEL[tierFor(seats)]}, ${day(now)} to ${day(sub.periodEnd)}, for the time left in this period`,
            quantity: extra,
            unitMinor: extra ? Math.round(amount / extra) : 0,
            amountMinor: amount,
          },
        ],
        periodStart: now,
        periodEnd: sub.periodEnd,
        dueAt: new Date(now.getTime() + PAYMENT_TERMS_DAYS * DAY),
        now,
      });
      await audit(tx, ctx.organisationId, who(ctx.actor), "billing.seats_requested", { type: "Invoice", id: inv.id }, { number: inv.number, from: sub.seats, to: seats }, ctx.ipAddress);
      return inv;
    },
    ctx.db,
  );
  const payUrl = method === "DPO" ? await payOnline(ctx, invoice.id, deps) : null;
  return { invoiceId: invoice.id, payUrl };
}

/** How the next renewal is billed. The period already paid for doesn't change. */
export async function changeRenewal(ctx: Ctx, input: { interval: BillingInterval; currency: Currency; seats: number; showBadge: boolean } & Pick<CheckoutInput, "billingName" | "billingEmail" | "billingAddress" | "taxNumber">, now = new Date()) {
  assertCan(ctx.actor, "manageBilling");
  const billing = cleanBilling(input);
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const sub = await subscriptionOf(tx, ctx.organisationId);
      const paid = sub.status === "ACTIVE" || sub.status === "PAST_DUE";
      const seats = Math.floor(input.seats);
      if (paid && (!Number.isFinite(seats) || seats < 1)) throw new DomainError("invalid", "Enter how many people to pay for.", "seats");
      const changed = paid && (sub.interval !== input.interval || sub.currency !== input.currency || sub.seats !== seats);
      const updated = await tx.subscription.update({
        where: { id: sub.id },
        data: { ...billing, showBadge: !!input.showBadge, ...(paid ? { interval: input.interval, currency: input.currency, renewalSeats: seats } : {}) },
      });
      // A renewal invoice already issued no longer matches; the worker issues a fresh one.
      if (changed) await tx.invoice.updateMany({ where: { kind: "RENEWAL", status: "OPEN" }, data: { status: "VOID", voidedAt: now } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "billing.changed", { type: "Subscription", id: sub.id }, { interval: input.interval, currency: input.currency, seats, showBadge: !!input.showBadge }, ctx.ipAddress);
      return updated;
    },
    ctx.db,
  );
}

/** A DPO Pay page for an open invoice. Made fresh each time, since DPO's tokens expire. */
export async function payOnline(ctx: Pick<Ctx, "db" | "organisationId" | "actor">, invoiceId: string, deps: BillingDeps): Promise<string> {
  assertCan(ctx.actor, "manageBilling");
  if (!deps.dpo) throw new DomainError("invalid", "Online payment isn't available yet. Pay by bank transfer.");
  const inv = await asTenant(ctx.organisationId, (tx) => tx.invoice.findFirst({ where: { id: invoiceId } }), ctx.db);
  if (!inv) throw new DomainError("not-found", "That invoice doesn't exist.");
  if (inv.status !== "OPEN") throw new DomainError("conflict", inv.status === "PAID" ? "That invoice is already paid." : "That invoice was cancelled.");
  const bill = inv.billTo as unknown as BillTo;
  let payment;
  try {
    payment = await createPayment(
      deps.dpo,
      {
        reference: inv.number,
        amountMinor: inv.totalMinor,
        currency: inv.currency,
        description: `Tshaeno invoice ${inv.number}`,
        redirectUrl: `${deps.origin}/app/billing/paid`,
        backUrl: `${deps.origin}/app/billing/invoices/${inv.id}`,
        customerEmail: bill.email || undefined,
      },
      deps.fetch,
    );
  } catch (e) {
    if (e instanceof ProviderError) throw new DomainError("conflict", e.message);
    throw e;
  }
  await asTenant(ctx.organisationId, (tx) => tx.invoice.update({ where: { id: inv.id }, data: { dpoToken: payment.token, method: "DPO" } }), ctx.db);
  return payment.url;
}

// ─── Payment ───────────────────────────────────────────────────────

export type PaidOutcome = { ok: true; invoice: Invoice } | { ok: false; message: string; organisationId?: string };

/**
 * Records a payment and applies what the invoice was for. Safe to call
 * twice: a paid invoice stays paid and nothing is applied again.
 */
export async function markPaid(invoiceId: string, payment: { reference: string; by: { userId: string | null; name: string } }, db?: PrismaClient, now = new Date()): Promise<Invoice> {
  return asSystem(async (tx) => {
    // Locks the row, so two confirmations can't both apply it.
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new DomainError("not-found", "That invoice doesn't exist.");
    if (inv.status === "PAID") return inv;
    const sub = await subscriptionOf(tx, inv.organisationId);
    let periodStart = inv.periodStart;
    let periodEnd = inv.periodEnd;
    if (inv.kind === "NEW") {
      // The plan runs from the day it is paid.
      periodStart = now;
      periodEnd = periodEndFrom(now, inv.interval);
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "ACTIVE", tier: inv.tier, interval: inv.interval, currency: inv.currency, seats: inv.seats, renewalSeats: null, periodStart, periodEnd },
      });
    } else if (inv.kind === "RENEWAL") {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "ACTIVE", tier: inv.tier, interval: inv.interval, currency: inv.currency, seats: inv.seats, renewalSeats: null, periodStart, periodEnd },
      });
    } else {
      await tx.subscription.update({ where: { id: sub.id }, data: { tier: inv.tier, seats: Math.max(sub.seats, inv.seats) } });
    }
    const paid = await tx.invoice.update({
      where: { id: inv.id },
      data: { status: "PAID", paidAt: now, paymentRef: payment.reference.slice(0, 120), periodStart, periodEnd, voidedAt: null },
    });
    await audit(tx, inv.organisationId, payment.by, "billing.paid", { type: "Invoice", id: inv.id }, { number: inv.number, reference: payment.reference });
    await queueBillingEmail(tx, sub, "payment_received", { invoiceId: inv.id });
    return paid;
  }, db);
}

/**
 * Asks DPO about an invoice's payment and records it when it went through
 * for the right amount. Used when the customer comes back from DPO and by
 * the worker, so a closed browser doesn't lose a payment.
 */
export async function confirmDpoPayment(token: string, deps: BillingDeps, db?: PrismaClient): Promise<PaidOutcome> {
  if (!deps.dpo) return { ok: false, message: "Online payment isn't set up." };
  const inv = await asSystem((tx) => tx.invoice.findUnique({ where: { dpoToken: token } }), db);
  if (!inv) return { ok: false, message: "We couldn't find that payment. If money left your account, contact us with your invoice number." };
  if (inv.status === "PAID") return { ok: true, invoice: inv };
  let state;
  try {
    state = await checkPayment(deps.dpo, token, deps.fetch);
  } catch (e) {
    if (e instanceof ProviderError) return { ok: false, message: "We couldn't check the payment with DPO Pay just now. We'll keep checking, and email you once it's through.", organisationId: inv.organisationId };
    throw e;
  }
  if (state.state === "waiting") return { ok: false, message: "The payment hasn't gone through yet. We'll email you once it has.", organisationId: inv.organisationId };
  if (state.state === "failed") return { ok: false, message: `${state.reason} You can try again from the invoice.`, organisationId: inv.organisationId };
  if (state.currency !== inv.currency || state.amountMinor !== inv.totalMinor) {
    console.error(`DPO payment ${token} for ${inv.number} was ${state.amountMinor} ${state.currency}, expected ${inv.totalMinor} ${inv.currency}.`);
    return { ok: false, message: "The amount paid doesn't match the invoice. We'll look into it and contact you.", organisationId: inv.organisationId };
  }
  const invoice = await markPaid(inv.id, { reference: `DPO ${state.reference}`, by: { userId: null, name: "DPO Pay" } }, db, deps.now);
  return { ok: true, invoice };
}

// ─── The daily round ───────────────────────────────────────────────

export interface TickResult {
  trialReminders: number;
  trialsEnded: number;
  renewalsIssued: number;
  pastDue: number;
  droppedToFree: number;
  paymentsConfirmed: number;
}

/**
 * Moves every directly billed organisation along: trial reminders and
 * endings, renewal invoices, overdue plans and lapses. Run by the worker.
 */
export async function billingTick(deps: BillingDeps, db?: PrismaClient): Promise<TickResult> {
  const now = deps.now ?? new Date();
  const r: TickResult = { trialReminders: 0, trialsEnded: 0, renewalsIssued: 0, pastDue: 0, droppedToFree: 0, paymentsConfirmed: 0 };
  const system = { userId: null, name: "Tshaeno billing" };
  const scope = deps.only ? { organisationId: { in: deps.only } } : {};

  await asSystem(async (tx) => {
    const soon = await tx.subscription.findMany({
      where: { ...scope, billedBy: "DIRECT", status: "TRIALING", trialReminderAt: null, trialEndsAt: { lte: new Date(now.getTime() + 3 * DAY), gt: now } },
    });
    for (const sub of soon) {
      await tx.subscription.update({ where: { id: sub.id }, data: { trialReminderAt: now } });
      await queueBillingEmail(tx, sub, "trial_ending", { organisationId: sub.organisationId });
      r.trialReminders++;
    }

    const ended = await tx.subscription.findMany({ where: { ...scope, billedBy: "DIRECT", status: "TRIALING", trialEndsAt: { lte: now } } });
    for (const sub of ended) {
      await tx.subscription.update({ where: { id: sub.id }, data: { status: "FREE" } });
      await audit(tx, sub.organisationId, system, "billing.trial_ended", { type: "Subscription", id: sub.id });
      r.trialsEnded++;
    }

    const renewing = await tx.subscription.findMany({
      where: { ...scope, billedBy: "DIRECT", status: "ACTIVE", periodEnd: { lte: new Date(now.getTime() + RENEWAL_NOTICE_DAYS * DAY) } },
      include: { organisation: { select: { name: true } } },
    });
    const prices = await currentPrices(tx);
    for (const sub of renewing) {
      const start = sub.periodEnd!;
      const existing = await tx.invoice.findFirst({ where: { organisationId: sub.organisationId, kind: "RENEWAL", periodStart: start, status: { in: ["OPEN", "PAID"] } } });
      if (existing) continue;
      const people = await tx.person.count({ where: { organisationId: sub.organisationId, active: true } });
      const seats = Math.max(sub.renewalSeats ?? sub.seats, people, 1);
      const unit = unitPrice(prices, tierFor(seats), sub.currency, sub.interval, sub.customMinor);
      if (unit == null) continue; // Quotes are renewed by staff.
      const end = periodEndFrom(start, sub.interval);
      await issueInvoice(tx, {
        organisationId: sub.organisationId,
        kind: "RENEWAL",
        method: deps.dpo ? "DPO" : "BANK_TRANSFER",
        sub,
        org: sub.organisation,
        currency: sub.currency,
        interval: sub.interval,
        seats,
        lines: [lineFor(seats, unit, sub.interval, sub.currency, start, end)],
        periodStart: start,
        periodEnd: end,
        dueAt: start,
        now,
      });
      r.renewalsIssued++;
    }

    const lapsed = await tx.subscription.findMany({ where: { ...scope, billedBy: "DIRECT", status: "ACTIVE", periodEnd: { lte: now } } });
    for (const sub of lapsed) {
      await tx.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
      await audit(tx, sub.organisationId, system, "billing.past_due", { type: "Subscription", id: sub.id });
      r.pastDue++;
    }

    const gone = await tx.subscription.findMany({ where: { ...scope, billedBy: "DIRECT", status: "PAST_DUE", periodEnd: { lte: new Date(now.getTime() - GRACE_DAYS * DAY) } } });
    for (const sub of gone) {
      await tx.subscription.update({ where: { id: sub.id }, data: { status: "FREE", seats: 0, periodStart: null, periodEnd: null } });
      await tx.invoice.updateMany({ where: { organisationId: sub.organisationId, kind: "RENEWAL", status: "OPEN" }, data: { status: "VOID", voidedAt: now } });
      await audit(tx, sub.organisationId, system, "billing.dropped_to_free", { type: "Subscription", id: sub.id });
      r.droppedToFree++;
    }
  }, db);

  // Payments started online but never confirmed, for example when the browser closed.
  if (deps.dpo) {
    const open = await asSystem(
      (tx) => tx.invoice.findMany({ where: { ...scope, status: "OPEN", dpoToken: { not: null }, issuedAt: { gte: new Date(now.getTime() - 60 * DAY) } }, select: { dpoToken: true }, take: 200 }),
      db,
    );
    for (const inv of open) if ((await confirmDpoPayment(inv.dpoToken!, deps, db)).ok) r.paymentsConfirmed++;
  }
  return r;
}

// ─── For the billing page ──────────────────────────────────────────

export async function billingOverview(organisationId: string, db?: PrismaClient, now = new Date()) {
  return asTenant(
    organisationId,
    async (tx) => {
      const sub = await subscriptionOf(tx, organisationId);
      const people = await activePeople(tx);
      const [prices, invoices] = await Promise.all([currentPrices(tx), tx.invoice.findMany({ orderBy: { issuedAt: "desc" }, take: 50 })]);
      return { sub, people, prices, invoices, summary: summarise(sub, people, now) };
    },
    db,
  );
}

/** Bank details for invoices, one item per line. Empty when not set. */
export function bankDetails(): string[] {
  return (env().BANK_DETAILS ?? "")
    .split(/\\n|\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function invoiceIssuer(): string[] {
  return env()
    .INVOICE_ISSUER.split(/\\n|\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Asks Tshaeno for an Enterprise price. Goes to sales by email and to the organisation's log. */
export async function requestQuote(ctx: Ctx, input: { people: number; note: string }, now = new Date()) {
  assertCan(ctx.actor, "manageBilling");
  const people = Math.floor(input.people);
  if (!Number.isFinite(people) || people < 1) throw new DomainError("invalid", "Enter roughly how many people.", "people");
  const note = input.note.trim().slice(0, 1000);
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const recent = await tx.auditLog.findFirst({ where: { action: "billing.quote_requested", createdAt: { gt: new Date(now.getTime() - DAY) } }, select: { id: true } });
      if (recent) throw new DomainError("conflict", "We already have your request from today. We'll be in touch.");
      const org = await tx.organisation.findUniqueOrThrow({ where: { id: ctx.organisationId }, select: { name: true } });
      const user = await tx.membership.findFirst({ where: { id: ctx.actor.membershipId }, include: { user: { select: { email: true } } } });
      const sales = env().SALES_EMAIL;
      if (sales) {
        await tx.outboundEmail.create({
          data: {
            kind: "quote_request",
            toAddress: sales,
            payload: { organisationId: ctx.organisationId, organisation: org.name, name: ctx.actor.name, email: user?.user.email ?? "", people: String(people), note },
          },
        });
      }
      await audit(tx, ctx.organisationId, who(ctx.actor), "billing.quote_requested", { type: "Organisation", id: ctx.organisationId }, { people, note }, ctx.ipAddress);
    },
    ctx.db,
  );
}

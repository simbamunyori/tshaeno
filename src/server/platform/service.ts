import type { Currency, PlanTier, PrismaClient } from "@prisma/client";
import { DAY } from "@/lib/billing/plans";
import { markPaid, subscriptionOf } from "@/server/billing/service";
import { asSystem, setScope } from "@/server/db";
import { DomainError } from "@/server/org/access";
import { audit, platformAudit } from "@/server/org/audit";

/**
 * The platform admin area, for Tshaeno staff only. It reads across
 * organisations, so every action is written to the platform trail, and
 * changes to an organisation also go in that organisation's own log.
 */

export interface StaffMember {
  userId: string;
  name: string;
  isPlatformAdmin: boolean;
}

function assertStaff(staff: StaffMember) {
  if (!staff.isPlatformAdmin) throw new DomainError("forbidden", "This area is for Tshaeno staff.");
}

export async function listOrganisations(staff: StaffMember, query: string, db?: PrismaClient) {
  assertStaff(staff);
  const q = query.trim();
  return asSystem(async (tx) => {
    const orgs = await tx.organisation.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { memberships: { where: { active: true } } } } },
    });
    if (q) await platformAudit(tx, staff, "platform.searched", null, { query: q });
    return orgs;
  }, db);
}

export async function organisationDetail(staff: StaffMember, organisationId: string, db?: PrismaClient) {
  assertStaff(staff);
  return asSystem(async (tx) => {
    const org = await tx.organisation.findUnique({
      where: { id: organisationId },
      include: {
        memberships: { where: { active: true }, include: { user: { select: { email: true, name: true, lastLoginAt: true } } }, orderBy: { createdAt: "asc" } },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!org) throw new DomainError("not-found", "No such organisation.");
    await platformAudit(tx, staff, "platform.viewed_organisation", org.id);
    return org;
  }, db);
}

export async function setOrganisationStatus(
  staff: StaffMember,
  organisationId: string,
  status: "ACTIVE" | "SUSPENDED",
  reason: string,
  ipAddress?: string | null,
  db?: PrismaClient,
) {
  assertStaff(staff);
  const why = reason.trim();
  if (!why) throw new DomainError("invalid", "Say why, for the record.", "reason");
  await asSystem(async (tx) => {
    const org = await tx.organisation.findUnique({ where: { id: organisationId } });
    if (!org) throw new DomainError("not-found", "No such organisation.");
    if (org.status === status) return;
    await tx.organisation.update({ where: { id: org.id }, data: { status } });
    const action = status === "SUSPENDED" ? "organisation.suspended" : "organisation.resumed";
    await platformAudit(tx, staff, `platform.${action}`, org.id, { reason: why }, ipAddress);
    await setScope(tx, { orgId: org.id });
    await audit(tx, org.id, { userId: null, name: `Tshaeno staff: ${staff.name}` }, action, { type: "Organisation", id: org.id }, { reason: why }, ipAddress);
  }, db);
}

export async function platformLog(staff: StaffMember, db?: PrismaClient) {
  assertStaff(staff);
  return asSystem((tx) => tx.platformAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }), db);
}

// ─── Billing ───────────────────────────────────────────────────────

export async function listPrices(staff: StaffMember, db?: PrismaClient) {
  assertStaff(staff);
  return asSystem((tx) => tx.planPrice.findMany({ orderBy: [{ currency: "asc" }, { tier: "asc" }] }), db);
}

export async function setPrice(
  staff: StaffMember,
  input: { tier: PlanTier; currency: Currency; monthlyMinor: number; annualMinor: number },
  ipAddress?: string | null,
  db?: PrismaClient,
) {
  assertStaff(staff);
  if (input.tier === "ENTERPRISE") throw new DomainError("invalid", "Enterprise is priced by quote, per organisation.");
  for (const [k, v] of [
    ["monthly", input.monthlyMinor],
    ["annual", input.annualMinor],
  ] as const) {
    if (!Number.isInteger(v) || v <= 0) throw new DomainError("invalid", "Enter a price above zero.", k);
  }
  if (input.annualMinor > input.monthlyMinor) throw new DomainError("invalid", "Annual billing shouldn't cost more a month than monthly.", "annual");
  await asSystem(async (tx) => {
    const before = await tx.planPrice.findUnique({ where: { tier_currency: { tier: input.tier, currency: input.currency } } });
    await tx.planPrice.upsert({
      where: { tier_currency: { tier: input.tier, currency: input.currency } },
      create: { ...input, updatedBy: staff.name },
      update: { monthlyMinor: input.monthlyMinor, annualMinor: input.annualMinor, updatedBy: staff.name },
    });
    await platformAudit(tx, staff, "platform.price_changed", null, { ...input, before: before ? { monthlyMinor: before.monthlyMinor, annualMinor: before.annualMinor } : null }, ipAddress);
  }, db);
}

export async function organisationBilling(staff: StaffMember, organisationId: string, db?: PrismaClient) {
  assertStaff(staff);
  return asSystem(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { organisationId } });
    const invoices = await tx.invoice.findMany({ where: { organisationId }, orderBy: { issuedAt: "desc" }, take: 50 });
    const people = await tx.person.count({ where: { organisationId, active: true } });
    return { sub, invoices, people };
  }, db);
}

/** A bank transfer arrived: staff record it against the invoice. */
export async function recordBankPayment(staff: StaffMember, invoiceId: string, reference: string, ipAddress?: string | null, db?: PrismaClient) {
  assertStaff(staff);
  const ref = reference.trim();
  if (!ref) throw new DomainError("invalid", "Enter the bank's reference for the payment.", "reference");
  const inv = await asSystem((tx) => tx.invoice.findUnique({ where: { id: invoiceId } }), db);
  if (!inv) throw new DomainError("not-found", "No such invoice.");
  if (inv.status !== "OPEN") throw new DomainError("conflict", "Only open invoices can be marked paid.");
  await markPaid(inv.id, { reference: `Bank ${ref}`, by: { userId: null, name: `Tshaeno staff: ${staff.name}` } }, db);
  await asSystem((tx) => platformAudit(tx, staff, "platform.invoice_paid", inv.organisationId, { number: inv.number, reference: ref }, ipAddress), db);
}

export async function voidInvoice(staff: StaffMember, invoiceId: string, reason: string, ipAddress?: string | null, db?: PrismaClient) {
  assertStaff(staff);
  const why = reason.trim();
  if (!why) throw new DomainError("invalid", "Say why, for the record.", "reason");
  await asSystem(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new DomainError("not-found", "No such invoice.");
    if (inv.status !== "OPEN") throw new DomainError("conflict", "Only open invoices can be cancelled.");
    await tx.invoice.update({ where: { id: inv.id }, data: { status: "VOID", voidedAt: new Date(), dpoToken: null } });
    await platformAudit(tx, staff, "platform.invoice_voided", inv.organisationId, { number: inv.number, reason: why }, ipAddress);
    await setScope(tx, { orgId: inv.organisationId });
    await audit(tx, inv.organisationId, { userId: null, name: `Tshaeno staff: ${staff.name}` }, "billing.invoice_voided", { type: "Invoice", id: inv.id }, { number: inv.number, reason: why }, ipAddress);
  }, db);
}

/** Gives an organisation more trial time, or a trial again after it ended. */
export async function extendTrial(staff: StaffMember, organisationId: string, days: number, ipAddress?: string | null, db?: PrismaClient, now = new Date()) {
  assertStaff(staff);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new DomainError("invalid", "Enter between 1 and 90 days.", "days");
  await asSystem(async (tx) => {
    const sub = await subscriptionOf(tx, organisationId);
    if (sub.status === "ACTIVE" || sub.status === "PAST_DUE") throw new DomainError("conflict", "They already have a paid plan.");
    const from = sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt > now ? sub.trialEndsAt : now;
    const trialEndsAt = new Date(from.getTime() + days * DAY);
    await tx.subscription.update({ where: { id: sub.id }, data: { status: "TRIALING", trialEndsAt, trialReminderAt: null } });
    await platformAudit(tx, staff, "platform.trial_extended", organisationId, { days, trialEndsAt: trialEndsAt.toISOString() }, ipAddress);
  }, db);
}

/** An agreed price per person per month for this organisation, or null to use the price list. */
export async function setCustomPrice(staff: StaffMember, organisationId: string, minor: number | null, ipAddress?: string | null, db?: PrismaClient) {
  assertStaff(staff);
  if (minor !== null && (!Number.isInteger(minor) || minor <= 0)) throw new DomainError("invalid", "Enter a price above zero, or leave it empty.", "price");
  await asSystem(async (tx) => {
    const sub = await subscriptionOf(tx, organisationId);
    await tx.subscription.update({ where: { id: sub.id }, data: { customMinor: minor } });
    await platformAudit(tx, staff, "platform.custom_price_set", organisationId, { minor, currency: sub.currency }, ipAddress);
  }, db);
}

// ─── Getting started ───────────────────────────────────────────────

export interface OnboardingStats {
  signedUp: number;
  live: number;
  /** Median minutes from sign-up to the first signature, for those live. */
  medianMinutes: number | null;
  /** Share live within 20 minutes, as a whole percentage of those signed up. */
  within20: number | null;
  quoteRequests: { organisationId: string; organisation: string; at: Date; data: unknown }[];
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

/** How quickly new organisations get their first signature live, over the last 30 days. */
export async function onboardingStats(staff: StaffMember, db?: PrismaClient, now = new Date()): Promise<OnboardingStats> {
  assertStaff(staff);
  return asSystem(async (tx) => {
    const since = new Date(now.getTime() - 30 * DAY);
    const orgs = await tx.organisation.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, firstSignatureAt: true } });
    const minutes = orgs.filter((o) => o.firstSignatureAt).map((o) => Math.max(0, Math.round((o.firstSignatureAt!.getTime() - o.createdAt.getTime()) / 60_000)));
    const quotes = await tx.auditLog.findMany({
      where: { action: "billing.quote_requested", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { organisation: { select: { name: true } } },
    });
    return {
      signedUp: orgs.length,
      live: minutes.length,
      medianMinutes: median(minutes),
      within20: orgs.length ? Math.round((minutes.filter((m) => m <= 20).length / orgs.length) * 100) : null,
      quoteRequests: quotes.map((q) => ({ organisationId: q.organisationId, organisation: q.organisation.name, at: q.createdAt, data: q.data })),
    };
  }, db);
}

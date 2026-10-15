import type { Organisation, Partner, PlanTier, Prisma, PrismaClient, Subscription } from "@prisma/client";
import { z } from "zod";
import { CURRENCIES, TIERS, tierFor } from "@/lib/billing/plans";
import { INVITATION_TTL_MS, newLinkToken, newOrganisationRow } from "@/server/auth/service";
import { open, seal } from "@/server/auth/secret-box";
import { asSystem, setScope, type Tx } from "@/server/db";
import { DomainError } from "@/server/org/access";
import { audit, platformAudit } from "@/server/org/audit";
import { assertStaff, type StaffMember } from "@/server/platform/service";
import { newKeyId, newSecret } from "./signing";

/**
 * What a partner such as Fourth Generation Technologies can do through
 * the partner API: set up an organisation for its customer, change its
 * plan and seats, pause, resume or cancel it, and read its usage. The
 * partner bills its customer; Tshaeno bills the partner. Partners never
 * see an organisation's people or signatures, only what they bill on.
 */

export class PartnerError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── What partners see ───────────────────────────────────────────────

export interface PartnerOrganisation {
  reference: string;
  id: string;
  name: string;
  plan: PlanTier;
  seats: number;
  currency: string;
  status: "active" | "suspended" | "cancelled";
  suspendedBy: "partner" | "tshaeno" | null;
  createdAt: string;
}

type OrgWithPlan = Organisation & { subscription: Subscription | null };

function view(org: OrgWithPlan): PartnerOrganisation {
  const suspended = org.status === "SUSPENDED";
  return {
    reference: org.partnerReference ?? "",
    id: org.id,
    name: org.name,
    plan: org.subscription?.tier ?? "STARTER",
    seats: org.subscription?.seats ?? 0,
    currency: org.subscription?.currency ?? "USD",
    status: suspended ? "suspended" : org.subscription?.status === "CANCELLED" ? "cancelled" : "active",
    suspendedBy: suspended ? (org.suspendedByPartner ? "partner" : "tshaeno") : null,
    createdAt: org.createdAt.toISOString(),
  };
}

async function findOrg(tx: Tx, partner: Partner, reference: string): Promise<OrgWithPlan> {
  await setScope(tx, { system: true });
  const org = await tx.organisation.findUnique({
    where: { partnerId_partnerReference: { partnerId: partner.id, partnerReference: reference } },
    include: { subscription: true },
  });
  if (!org) throw new PartnerError(404, "not_found", `No organisation with reference "${reference}".`);
  return org;
}

const reread = (tx: Tx, id: string) => tx.organisation.findUniqueOrThrow({ where: { id }, include: { subscription: true } }).then(view);

async function orgAudit(tx: Tx, organisationId: string, partner: Partner, action: string, data?: Prisma.InputJsonValue) {
  await audit(tx, organisationId, { userId: null, name: `${partner.name} (partner)` }, action, { type: "Organisation", id: organisationId }, data);
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new PartnerError(
      422,
      "invalid",
      "Some fields are missing or wrong.",
      r.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    );
  }
  return r.data;
}

const activePeople = (tx: Tx, organisationId: string) => tx.person.count({ where: { organisationId, active: true } });

// ─── Provisioning ────────────────────────────────────────────────────

const plan = z.enum(TIERS as unknown as [PlanTier, ...PlanTier[]]);
const seats = z.number().int().min(1).max(1_000_000);
const currency = z.enum(CURRENCIES as unknown as ["BWP", "ZAR", "USD"]);

const ProvisionInput = z
  .object({
    reference: z.string().trim().min(1).max(100),
    name: z.string().trim().min(2).max(120),
    plan: plan.optional(),
    seats,
    currency: currency.default("BWP"),
    owner: z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().toLowerCase().email() }),
  })
  .strict();

/**
 * A new organisation for the partner's customer, on the plan the partner
 * sells them. Its owner is emailed an invitation, or joins straight away
 * by signing in from the Fourth Generation console.
 */
export async function provision(db: PrismaClient | undefined, partner: Partner, body: unknown, now = new Date()): Promise<PartnerOrganisation> {
  const input = parse(ProvisionInput, body);
  return asSystem(async (tx) => {
    const existing = await tx.organisation.findUnique({
      where: { partnerId_partnerReference: { partnerId: partner.id, partnerReference: input.reference } },
      select: { id: true },
    });
    if (existing) throw new PartnerError(409, "exists", `An organisation with reference "${input.reference}" already exists.`);
    const org = await newOrganisationRow(tx, input.name, {
      partnerId: partner.id,
      partnerReference: input.reference,
      ...(input.currency === "ZAR" ? { timeZone: "Africa/Johannesburg" } : {}),
    });
    await tx.subscription.create({
      data: {
        organisationId: org.id,
        status: "ACTIVE",
        billedBy: "PARTNER",
        tier: input.plan ?? tierFor(input.seats),
        seats: input.seats,
        currency: input.currency,
        billingName: input.name,
      },
    });
    const invitation = await tx.invitation.create({
      data: {
        organisationId: org.id,
        email: input.owner.email,
        role: "OWNER",
        // Placeholder until the email is sent; never matches a real link.
        tokenHash: newLinkToken().tokenHash,
        invitedByLabel: partner.name,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      },
    });
    await tx.outboundEmail.create({ data: { kind: "invitation", toAddress: input.owner.email, payload: { invitationId: invitation.id } } });
    await orgAudit(tx, org.id, partner, "organisation.provisioned", {
      plan: input.plan ?? tierFor(input.seats),
      seats: input.seats,
      currency: input.currency,
      owner: { name: input.owner.name, email: input.owner.email },
    });
    return reread(tx, org.id);
  }, db);
}

export async function getOrganisation(db: PrismaClient | undefined, partner: Partner, reference: string) {
  return asSystem(async (tx) => view(await findOrg(tx, partner, reference)), db);
}

const UpdateInput = z.object({ name: z.string().trim().min(2).max(120).optional(), plan: plan.optional(), seats: seats.optional() }).strict();

/** A new plan, a new number of seats, or a new name. Fewer seats than people already in the directory is refused. */
export async function updateOrganisation(db: PrismaClient | undefined, partner: Partner, reference: string, body: unknown) {
  const input = parse(UpdateInput, body ?? {});
  return asSystem(async (tx) => {
    const org = await findOrg(tx, partner, reference);
    const sub = org.subscription!;
    if (input.seats !== undefined) {
      const people = await activePeople(tx, org.id);
      if (input.seats < people) {
        throw new PartnerError(409, "too_few_seats", `This organisation has ${people} people in its directory, more than ${input.seats} seats.`, { people });
      }
    }
    if (input.name && input.name !== org.name) await tx.organisation.update({ where: { id: org.id }, data: { name: input.name } });
    if (input.plan !== undefined || input.seats !== undefined) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { ...(input.plan ? { tier: input.plan } : {}), ...(input.seats !== undefined ? { seats: input.seats } : {}) },
      });
    }
    await orgAudit(tx, org.id, partner, "organisation.changed_by_partner", {
      from: { name: org.name, plan: sub.tier, seats: sub.seats },
      to: { name: input.name ?? org.name, plan: input.plan ?? sub.tier, seats: input.seats ?? sub.seats },
    });
    return reread(tx, org.id);
  }, db);
}

const ReasonInput = z.object({ reason: z.string().trim().max(300).optional() }).strict();

const TSHAENO_PAUSE = "Tshaeno has suspended this organisation. Contact Tshaeno.";

/** Paused, for example for an unpaid bill. Members see the reason and can't sign in; nothing is deleted. */
export async function suspend(db: PrismaClient | undefined, partner: Partner, reference: string, body: unknown, now = new Date()) {
  const { reason } = parse(ReasonInput, body ?? {});
  return asSystem(async (tx) => {
    const org = await findOrg(tx, partner, reference);
    if (org.status === "SUSPENDED" && !org.suspendedByPartner) throw new PartnerError(409, "suspended_by_tshaeno", TSHAENO_PAUSE);
    if (org.status !== "SUSPENDED") {
      await tx.organisation.update({
        where: { id: org.id },
        data: {
          status: "SUSPENDED",
          suspendedByPartner: true,
          suspendedReason: reason ? `${partner.name}: ${reason}` : `Paused by ${partner.name}. Contact them to carry on.`,
        },
      });
      await orgAudit(tx, org.id, partner, "organisation.suspended_by_partner", { reason: reason ?? null, at: now.toISOString() });
    }
    return reread(tx, org.id);
  }, db);
}

/** Lifts the partner's own pause, or brings back a cancelled organisation. */
export async function resume(db: PrismaClient | undefined, partner: Partner, reference: string) {
  return asSystem(async (tx) => {
    const org = await findOrg(tx, partner, reference);
    if (org.status === "SUSPENDED" && !org.suspendedByPartner) throw new PartnerError(409, "suspended_by_tshaeno", TSHAENO_PAUSE);
    const paused = org.status === "SUSPENDED";
    const cancelled = org.subscription?.status === "CANCELLED";
    if (paused) await tx.organisation.update({ where: { id: org.id }, data: { status: "ACTIVE", suspendedByPartner: false, suspendedReason: null } });
    if (cancelled) await tx.subscription.update({ where: { id: org.subscription!.id }, data: { status: "ACTIVE" } });
    if (paused || cancelled) await orgAudit(tx, org.id, partner, "organisation.resumed_by_partner");
    return reread(tx, org.id);
  }, db);
}

/**
 * Ends the service. People can still sign in and look, but the directory
 * stops syncing and Tshaeno stops applying signatures. Signatures already
 * in Gmail stay until someone changes them.
 */
export async function cancel(db: PrismaClient | undefined, partner: Partner, reference: string, body: unknown) {
  const { reason } = parse(ReasonInput, body ?? {});
  return asSystem(async (tx) => {
    const org = await findOrg(tx, partner, reference);
    if (org.subscription && org.subscription.status !== "CANCELLED") {
      await tx.subscription.update({ where: { id: org.subscription.id }, data: { status: "CANCELLED" } });
      await orgAudit(tx, org.id, partner, "organisation.cancelled_by_partner", { reason: reason ?? null });
    }
    return reread(tx, org.id);
  }, db);
}

/** The numbers a partner bills on. No names, addresses or signatures. */
export async function organisationUsage(db: PrismaClient | undefined, partner: Partner, reference: string, now = new Date()) {
  return asSystem(async (tx) => {
    const org = await findOrg(tx, partner, reference);
    const where = { organisationId: org.id };
    const [people, members, connections, live, addin, last, changed30] = await Promise.all([
      activePeople(tx, org.id),
      tx.membership.count({ where: { ...where, active: true } }),
      tx.directoryConnection.findMany({ where, select: { provider: true, status: true } }),
      tx.signatureDelivery.groupBy({ by: ["personId"], where: { ...where, state: "APPLIED" } }),
      tx.outlookAddin.count({ where }),
      tx.auditLog.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      tx.auditLog.count({ where: { ...where, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
    ]);
    return {
      reference,
      plan: org.subscription?.tier ?? "STARTER",
      seats: org.subscription?.seats ?? 0,
      people,
      admins: members,
      connected: connections.map((c) => ({ provider: c.provider === "GOOGLE" ? "google_workspace" : "microsoft_365", status: c.status.toLowerCase() })),
      outlookAddIn: addin > 0,
      peopleWithSignature: live.length,
      firstSignatureAt: org.firstSignatureAt?.toISOString() ?? null,
      changesLast30Days: changed30,
      lastActivityAt: last?.createdAt.toISOString() ?? null,
    };
  }, db);
}

/** Tshaeno's prices per person per month, and what the partner pays after its discount, in minor units written as strings. */
export async function partnerPrices(db: PrismaClient | undefined, partner: Partner) {
  const rows = await asSystem((tx) => tx.planPrice.findMany(), db);
  const off = (v: number) => String(v - Math.round((v * partner.wholesaleDiscountPercent) / 100));
  return {
    wholesaleDiscountPercent: partner.wholesaleDiscountPercent,
    prices: TIERS.flatMap((tier) =>
      CURRENCIES.flatMap((cur) => {
        const p = rows.find((r) => r.tier === tier && r.currency === cur);
        if (!p) return [];
        return [
          {
            plan: tier,
            currency: cur,
            retail: { monthly: String(p.monthlyMinor), annual: String(p.annualMinor) },
            wholesale: { monthly: off(p.monthlyMinor), annual: off(p.annualMinor) },
          },
        ];
      }),
    ),
  };
}

// ─── Staff: setting partners up ──────────────────────────────────────

export function partnerSecret(partner: Pick<Partner, "secretSealed">, encryptionKey: string): string {
  return open(partner.secretSealed, encryptionKey);
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, 80);

export async function listPartners(staff: StaffMember, db?: PrismaClient) {
  assertStaff(staff);
  return asSystem(
    (tx) =>
      tx.partner.findMany({
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { organisations: true } } },
      }),
    db,
  );
}

export async function partnerDetail(staff: StaffMember, partnerId: string, db?: PrismaClient) {
  assertStaff(staff);
  return asSystem(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: partnerId } });
    if (!partner) return null;
    const [organisations, requests] = await Promise.all([
      tx.organisation.findMany({
        where: { partnerId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, name: true, partnerReference: true, status: true, createdAt: true, subscription: { select: { tier: true, seats: true, status: true } } },
      }),
      tx.partnerRequest.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return { partner, organisations, requests };
  }, db);
}

/** A new partner. The secret is returned once, to show to staff; afterwards only its sealed form is kept. */
export async function createPartner(staff: StaffMember, name: string, encryptionKey: string, ipAddress?: string | null, db?: PrismaClient) {
  assertStaff(staff);
  const clean = cleanName(name);
  if (clean.length < 2) throw new DomainError("invalid", "Enter the partner's name.", "name");
  const secret = newSecret();
  const partner = await asSystem(async (tx) => {
    const p = await tx.partner.create({ data: { name: clean, keyId: newKeyId(), secretSealed: seal(secret, encryptionKey) } });
    await platformAudit(tx, staff, "partner.created", null, { partner: p.name, keyId: p.keyId }, ipAddress);
    return p;
  }, db);
  return { partner, secret };
}

/** A new secret; the old one stops working at once. */
export async function rotateSecret(staff: StaffMember, partnerId: string, encryptionKey: string, ipAddress?: string | null, db?: PrismaClient) {
  assertStaff(staff);
  const secret = newSecret();
  await asSystem(async (tx) => {
    const p = await tx.partner.update({ where: { id: partnerId }, data: { secretSealed: seal(secret, encryptionKey) } });
    await platformAudit(tx, staff, "partner.secret_rotated", null, { partner: p.name, keyId: p.keyId }, ipAddress);
  }, db);
  return secret;
}

const IP = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;

export async function updatePartner(
  staff: StaffMember,
  partnerId: string,
  input: { name: string; allowedIps: string; wholesaleDiscountPercent: string; active: boolean },
  ipAddress?: string | null,
  db?: PrismaClient,
) {
  assertStaff(staff);
  const name = cleanName(input.name);
  if (name.length < 2) throw new DomainError("invalid", "Enter the partner's name.", "name");
  const ips = [...new Set(input.allowedIps.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
  const bad = ips.find((ip) => !IP.test(ip));
  if (bad) throw new DomainError("invalid", `"${bad}" isn't an IP address.`, "allowedIps");
  const discount = Number(input.wholesaleDiscountPercent);
  if (!Number.isInteger(discount) || discount < 0 || discount > 90) {
    throw new DomainError("invalid", "The wholesale discount is a whole percentage from 0 to 90.", "wholesaleDiscountPercent");
  }
  await asSystem(async (tx) => {
    const before = await tx.partner.findUniqueOrThrow({ where: { id: partnerId } });
    await tx.partner.update({ where: { id: partnerId }, data: { name, allowedIps: ips, wholesaleDiscountPercent: discount, active: input.active } });
    await platformAudit(
      tx,
      staff,
      "partner.changed",
      null,
      {
        partner: name,
        from: { allowedIps: before.allowedIps, discount: before.wholesaleDiscountPercent, active: before.active },
        to: { allowedIps: ips, discount, active: input.active },
      },
      ipAddress,
    );
  }, db);
}

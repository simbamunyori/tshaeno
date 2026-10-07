import type { PrismaClient } from "@prisma/client";
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

import { cache } from "react";
import { FEATURE_LABEL, hasPremium, type Feature, type PlanAccess } from "@/lib/billing/features";
import { asTenant, type Tx } from "@/server/db";
import { DomainError } from "@/server/org/access";

const SELECT = { status: true, billedBy: true, package: true } as const;

export async function planAccess(tx: Tx, organisationId: string): Promise<PlanAccess | null> {
  return tx.subscription.findUnique({ where: { organisationId }, select: SELECT });
}

export async function premiumFor(tx: Tx, organisationId: string): Promise<boolean> {
  return hasPremium(await planAccess(tx, organisationId));
}

/** Stops a premium action on an organisation that only has free signatures. */
export async function requirePremium(tx: Tx, organisationId: string, feature: Feature): Promise<void> {
  const access = await planAccess(tx, organisationId);
  if (hasPremium(access)) return;
  const how = access?.billedBy === "PARTNER" ? "Ask Fourth Generation to move you to the full plan" : "Choose a plan in Plan and billing";
  throw new DomainError("forbidden", `${FEATURE_LABEL[feature]} are part of the full plan. ${how} to use them.`);
}

/** The organisation's plan access, for pages. Cached per request. */
export const orgAccess = cache(async (organisationId: string) => {
  const access = await asTenant(organisationId, (tx) => planAccess(tx, organisationId));
  return { access, premium: hasPremium(access), partner: access?.billedBy === "PARTNER" };
});

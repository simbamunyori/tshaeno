import type { BilledBy, PlanPackage, SubscriptionStatus } from "@prisma/client";

/**
 * Which features need more than free signatures. Fourth Generation
 * hosting customers get signatures free, and so do teams on the free
 * plan after a trial; everything here needs a trial, a paid plan or the
 * full package from the partner.
 */
export type Feature = "campaigns" | "reports" | "claude" | "backgrounds" | "away";

export const FEATURE_LABEL: Record<Feature, string> = {
  campaigns: "Campaigns",
  reports: "Reports",
  claude: "Help from Claude",
  backgrounds: "Meeting backgrounds",
  away: "Out-of-office messages",
};

export const PREMIUM_NAV: Record<string, Feature> = {
  "/app/campaigns": "campaigns",
  "/app/analytics": "reports",
  "/app/backgrounds": "backgrounds",
  "/app/away": "away",
};

export type PlanAccess = { status: SubscriptionStatus; billedBy: BilledBy; package: PlanPackage };

/** Whether the organisation can use premium features. No subscription yet means a trial is about to start. */
export function hasPremium(sub: PlanAccess | null): boolean {
  if (!sub) return true;
  if (sub.status === "CANCELLED") return false;
  if (sub.billedBy === "PARTNER") return sub.package === "FULL";
  return sub.status === "TRIALING" || sub.status === "ACTIVE" || sub.status === "PAST_DUE";
}

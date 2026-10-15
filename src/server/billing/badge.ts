import type { Subscription } from "@prisma/client";
import type { Tx } from "@/server/db";
import { env } from "@/server/env";

/** Whether signatures carry the "Signature by Tshaeno" link. */
export function showsBadge(sub: Pick<Subscription, "status" | "showBadge" | "billedBy"> | null): boolean {
  if (!sub || sub.billedBy === "PARTNER") return false;
  if (sub.status === "FREE") return true;
  if (sub.status === "TRIALING") return false;
  return sub.showBadge;
}

/** Where the link goes, tagged so the website can count sign-ups it brings. */
export function badgeUrl(): string {
  return `${env().WEBSITE_URL.replace(/\/$/, "")}/?ref=signature`;
}

/** The badge link for this organisation, or null when its signatures don't carry one. */
export async function badgeFor(tx: Tx, organisationId: string): Promise<string | null> {
  const sub = await tx.subscription.findUnique({ where: { organisationId }, select: { status: true, showBadge: true, billedBy: true } });
  return showsBadge(sub) ? badgeUrl() : null;
}

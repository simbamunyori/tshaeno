import type { Organisation } from "@prisma/client";
import type { Tx } from "@/server/db";
import { DAY, TRIAL_DAYS, currencyForTimeZone } from "@/lib/billing/plans";

/** Every new organisation starts a trial, priced in its own currency. */
export async function startTrial(tx: Tx, org: Pick<Organisation, "id" | "timeZone">, now = new Date()) {
  return tx.subscription.create({
    data: { organisationId: org.id, status: "TRIALING", trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY), currency: currencyForTimeZone(org.timeZone) },
  });
}

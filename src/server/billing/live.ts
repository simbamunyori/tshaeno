import type { Prisma } from "@prisma/client";
import type { Tx } from "@/server/db";

/**
 * Organisations Tshaeno still works for: not suspended, and not cancelled
 * by the partner that bills them. The others keep their data, but nothing
 * is synced or applied for them.
 */
export const LIVE_ORGANISATION = {
  status: "ACTIVE",
  NOT: [{ subscription: { is: { status: "CANCELLED" } } }],
} satisfies Prisma.OrganisationWhereInput;

export async function isLive(tx: Tx, organisationId: string): Promise<boolean> {
  return (await tx.organisation.count({ where: { id: organisationId, ...LIVE_ORGANISATION } })) > 0;
}

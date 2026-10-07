import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireActiveSession } from "@/server/auth/next";
import { asUser, prisma } from "@/server/db";
import type { Actor } from "./access";

/**
 * Everything a signed-in page needs: who is acting and in which
 * organisation. Cached per request, so the layout and page share one
 * lookup. Database work then goes through asTenant(organisation.id, ...).
 */
export const requireMember = cache(async () => {
  const session = await requireActiveSession();
  const membership = session.activeOrganisationId
    ? await asUser(session.userId, (tx) =>
        tx.membership.findUnique({
          where: { organisationId_userId: { organisationId: session.activeOrganisationId!, userId: session.userId } },
          include: { organisation: true },
        }),
      )
    : null;
  if (!membership || !membership.active || membership.organisation.status !== "ACTIVE") {
    // Removed from this organisation, or it was suspended, but still in another: open that one.
    const other = await asUser(session.userId, (tx) =>
      tx.membership.findFirst({
        where: { userId: session.userId, active: true, organisation: { status: "ACTIVE" } },
        orderBy: { createdAt: "asc" },
        select: { organisationId: true },
      }),
    );
    if (!other) redirect("/welcome");
    await prisma.session.update({ where: { id: session.id }, data: { activeOrganisationId: other.organisationId } });
    redirect("/app");
  }
  const actor: Actor = {
    membershipId: membership.id,
    userId: session.userId,
    name: session.user.name,
    role: membership.role,
  };
  return { session, actor, organisation: membership.organisation };
});

export type MemberContext = Awaited<ReturnType<typeof requireMember>>;

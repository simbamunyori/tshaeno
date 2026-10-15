import type { PrismaClient } from "@prisma/client";
import { asTenant } from "@/server/db";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { starter } from "@/lib/signature/starters";
import { addAssignment, createTemplate, publishTemplate } from "@/server/signatures/templates";

/**
 * The guided start for small teams: the fewest steps from signing up to a
 * signature in everyone's email.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

/**
 * Picks a template and applies it in one go: made from the starter in the
 * organisation's brand, published, and given to everyone when no other
 * rule exists yet. It can all be changed later in the studio.
 */
export async function quickStart(ctx: Ctx, starterKey: string): Promise<{ templateId: string; everyone: boolean }> {
  assertCan(ctx.actor, "manageTemplates");
  const s = starter(starterKey);
  if (!s) throw new DomainError("invalid", "Choose a template.");
  const t = await createTemplate(ctx, { name: s.name, kind: "VISUAL", starterKey: s.key });
  await publishTemplate(ctx, t.id);
  const rules = await asTenant(ctx.organisationId, (tx) => tx.signatureAssignment.count(), ctx.db);
  if (rules === 0) await addAssignment(ctx, { templateId: t.id, scope: "EVERYONE", forNew: true, forReply: true });
  return { templateId: t.id, everyone: rules === 0 };
}

export interface StartState {
  minutesSinceSignUp: number;
  people: number;
  connected: "GOOGLE" | "MICROSOFT" | null;
  connectionPending: boolean;
  hasLogo: boolean;
  published: number;
  rules: number;
  addin: boolean;
  gmailApplied: number;
  outlookApplied: number;
  firstSignatureAt: Date | null;
}

export async function startState(organisationId: string, now = new Date(), db?: PrismaClient): Promise<StartState> {
  return asTenant(
    organisationId,
    async (tx) => {
      const org = await tx.organisation.findUniqueOrThrow({ where: { id: organisationId }, select: { createdAt: true, firstSignatureAt: true } });
      const [people, connections, logos, published, rules, addin, gmailApplied, outlookApplied] = await Promise.all([
        tx.person.count({ where: { active: true } }),
        tx.directoryConnection.findMany({ select: { provider: true, status: true } }),
        tx.brandKit.count({ where: { logoAssetId: { not: null } } }),
        tx.signatureTemplate.count({ where: { publishedVersionId: { not: null }, archivedAt: null } }),
        tx.signatureAssignment.count(),
        tx.outlookAddin.count(),
        tx.signatureDelivery.count({ where: { target: "GMAIL", state: "APPLIED" } }),
        tx.signatureDelivery.count({ where: { target: "OUTLOOK", state: "APPLIED" } }),
      ]);
      const live = connections.find((c) => c.status === "CONNECTED");
      return {
        minutesSinceSignUp: Math.max(0, Math.round((now.getTime() - org.createdAt.getTime()) / 60_000)),
        people,
        connected: live?.provider ?? null,
        connectionPending: !live && connections.length > 0,
        hasLogo: logos > 0,
        published,
        rules,
        addin: addin > 0,
        gmailApplied,
        outlookApplied,
        firstSignatureAt: org.firstSignatureAt,
      };
    },
    db,
  );
}

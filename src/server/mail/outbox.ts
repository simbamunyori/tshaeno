import type { OutboundEmail, PrismaClient } from "@prisma/client";
import { asSystem } from "@/server/db";
import { env } from "@/server/env";
import { issueEmailToken, newLinkToken } from "@/server/auth/service";
import { ROLE_LABEL } from "@/server/org/access";
import { formatMoney } from "@/lib/billing/plans";
import { issueLinkToken } from "@/server/portal/service";
import { invitation, invoiceIssued, paymentReceived, portalLink, quoteRequest, trialEnding, verifyEmail, type Rendered } from "./templates";
import { send, type Message } from "./transport";

export const MAX_ATTEMPTS = 5;
/** How long a claimed row is held before another worker may try it. */
const LEASE_MINUTES = 5;

/**
 * Claims up to `limit` emails that are due. Pushing sendAfter forward is
 * the lease: another worker skips locked rows now and leased rows later,
 * so nothing is sent twice even with several workers.
 */
async function claim(db: PrismaClient, limit: number): Promise<OutboundEmail[]> {
  return db.$queryRaw<OutboundEmail[]>`
    UPDATE "OutboundEmail" SET attempts = attempts + 1,
      "sendAfter" = now() + make_interval(mins => (${LEASE_MINUTES}::int * (attempts + 1)))
    WHERE id IN (
      SELECT id FROM "OutboundEmail"
      WHERE status = 'PENDING' AND "sendAfter" <= now()
      ORDER BY "createdAt" LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

/** Builds the message, making any link fresh. Null when there is nothing to send any more. */
export async function render(db: PrismaClient, row: OutboundEmail): Promise<Rendered | null> {
  const payload = row.payload as Record<string, string>;
  const base = env().APP_URL.replace(/\/$/, "");
  if (row.kind === "verify_email") {
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.emailVerifiedAt) return null;
    const token = await issueEmailToken(db, user.id);
    return verifyEmail({ name: user.name, url: `${base}/verify-email/${token}` });
  }
  if (row.kind === "invitation") {
    return asSystem(async (tx) => {
      const inv = await tx.invitation.findUnique({
        where: { id: payload.invitationId },
        include: { organisation: true, invitedBy: { include: { user: true } } },
      });
      if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt.getTime() <= Date.now()) return null;
      // Only the newest email's link works.
      const { token, tokenHash } = newLinkToken();
      await tx.invitation.update({ where: { id: inv.id }, data: { tokenHash } });
      return invitation({
        organisation: inv.organisation.name,
        inviter: inv.invitedBy.user.name,
        role: ROLE_LABEL[inv.role],
        url: `${base}/invite/${token}`,
      });
    }, db);
  }
  const longDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);
  if (row.kind === "invoice" || row.kind === "payment_received") {
    return asSystem(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id: payload.invoiceId }, include: { organisation: { select: { name: true } } } });
      if (!inv || inv.status === "VOID" || (row.kind === "invoice" && inv.status === "PAID")) return null;
      const input = { organisation: inv.organisation.name, number: inv.number, total: formatMoney(inv.totalMinor, inv.currency), url: `${base}/app/billing/invoices/${inv.id}` };
      return row.kind === "invoice" ? invoiceIssued({ ...input, due: longDate(inv.dueAt), renewal: inv.kind === "RENEWAL" }) : paymentReceived(input);
    }, db);
  }
  if (row.kind === "trial_ending") {
    return asSystem(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { organisationId: payload.organisationId }, include: { organisation: { select: { name: true } } } });
      if (!sub || sub.status !== "TRIALING" || !sub.trialEndsAt) return null;
      return trialEnding({ organisation: sub.organisation.name, ends: longDate(sub.trialEndsAt), url: `${base}/app/billing` });
    }, db);
  }
  if (row.kind === "portal_link") {
    return asSystem(async (tx) => {
      const issued = await issueLinkToken(tx, payload.linkId);
      if (!issued) return null;
      return portalLink({ firstName: issued.firstName, organisation: issued.organisation, url: `${base}/me/link/${issued.token}` });
    }, db);
  }
  if (row.kind === "quote_request") {
    return quoteRequest({ organisation: payload.organisation, name: payload.name, email: payload.email, people: payload.people, note: payload.note ?? "", url: `${base}/admin/organisations/${payload.organisationId}` });
  }
  throw new Error(`Unknown email kind ${row.kind}.`);
}

/** Sends whatever is due. Returns how many went out. */
export async function drainOutbox(db: PrismaClient, sender: (m: Message) => Promise<void> = send, limit = 20): Promise<number> {
  let sent = 0;
  for (const row of await claim(db, limit)) {
    try {
      const message = await render(db, row);
      if (message) await sender({ to: row.toAddress, ...message });
      await db.outboundEmail.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), lastError: message ? null : "Nothing to send any more." } });
      if (message) sent++;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await db.outboundEmail.update({
        where: { id: row.id },
        data: { lastError: error.slice(0, 500), status: row.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING" },
      });
    }
  }
  return sent;
}

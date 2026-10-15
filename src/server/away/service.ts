import type { AwayMessage, Person, PrismaClient } from "@prisma/client";
import { escapeHtml } from "@/lib/signature/style";
import { requirePremium } from "@/server/billing/premium";
import { ProviderError } from "@/server/connections/http";
import { realProviders, type Providers } from "@/server/connections/service";
import { asTenant, type Tx } from "@/server/db";
import { GMAIL_CONTEXT } from "@/server/delivery/gmail";
import { appOrigin } from "@/server/env";
import { OrgRenderer } from "@/server/delivery/renderer";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { PHOTO_SELECT } from "@/server/signatures/people";

/**
 * Out-of-office replies an admin sets for someone. Gmail and Outlook both
 * take a start and an end, so the reply switches itself on and off there;
 * Tshaeno only sets it once, and turns it off if the admin cancels.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
  now?: Date;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });
const DAY = 86_400_000;

export interface AwayInput {
  personId: string;
  reason: string;
  startsAt: Date | null;
  endsAt: Date | null;
  subject: string;
  message: string;
  withSignature: boolean;
}

export type AwayState = "scheduled" | "on" | "ended" | "cancelled";

export function awayState(a: Pick<AwayMessage, "status" | "startsAt" | "endsAt">, now = new Date()): AwayState {
  if (a.status === "CANCELLED") return "cancelled";
  if (a.endsAt <= now) return "ended";
  return a.startsAt > now ? "scheduled" : "on";
}

/** The reply as HTML: the message as paragraphs, then the person's signature when they have one. */
export function awayHtml(message: string, signature: string | null): string {
  const paragraphs = message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:1.5;color:#1f1f1f">${paragraphs}</div>${signature ? `<br>${signature}` : ""}`;
}

function clean(input: AwayInput, now: Date) {
  const reason = input.reason.trim().slice(0, 60) || "Away";
  const subject = input.subject.trim().replace(/\s+/g, " ");
  const message = input.message.replace(/\r\n/g, "\n").trim();
  if (!input.startsAt) throw new DomainError("invalid", "Enter when they leave.", "startsAt");
  if (!input.endsAt) throw new DomainError("invalid", "Enter when they're back.", "endsAt");
  if (input.endsAt <= input.startsAt) throw new DomainError("invalid", "They need to be back after they leave.", "endsAt");
  if (input.endsAt <= now) throw new DomainError("invalid", "That's already over. Choose dates in the future.", "endsAt");
  if (input.endsAt.getTime() - input.startsAt.getTime() > 366 * DAY) throw new DomainError("invalid", "Keep it to a year or less.", "endsAt");
  if (!subject || subject.length > 120) throw new DomainError("invalid", "Enter a subject under 120 characters.", "subject");
  if (message.length < 10) throw new DomainError("invalid", "Write the message people will get.", "message");
  if (message.length > 4000) throw new DomainError("invalid", "Keep the message under 4,000 characters.", "message");
  return { reason, subject, message, startsAt: input.startsAt, endsAt: input.endsAt, withSignature: input.withSignature };
}

type Target = { kind: "gmail"; email: string } | { kind: "outlook"; email: string; tenantId: string } | null;

async function targetFor(tx: Tx, p: Pick<Person, "email" | "source">): Promise<Target> {
  if (p.source === "GOOGLE") {
    const c = await tx.directoryConnection.findFirst({ where: { provider: "GOOGLE" }, select: { id: true } });
    return c ? { kind: "gmail", email: p.email } : null;
  }
  if (p.source === "MICROSOFT") {
    const c = await tx.directoryConnection.findFirst({ where: { provider: "MICROSOFT" }, select: { tenantId: true } });
    return c?.tenantId ? { kind: "outlook", email: p.email, tenantId: c.tenantId } : null;
  }
  return null;
}

const MAILBOX = { gmail: "Gmail", outlook: "Outlook" } as const;

/** Sets it in the mailbox, or switches it off with null. Throws ProviderError. */
async function push(target: NonNullable<Target>, providers: Providers, reply: { subject: string; html: string; startsAt: Date; endsAt: Date } | null) {
  if (target.kind === "gmail") {
    const g = providers.google();
    if (!g) throw new ProviderError("not-configured", "This Tshaeno server isn't set up for Google yet.");
    await g.setVacation(target.email, reply);
  } else {
    const m = providers.microsoft(target.tenantId);
    if (!m) throw new ProviderError("not-configured", "This Tshaeno server isn't set up for Microsoft 365 yet.");
    await m.setAutoReply(target.email, reply);
  }
}

/**
 * Saves an out-of-office reply for someone and sets it in their mailbox.
 * An earlier one for them that hasn't ended is replaced.
 */
export async function setAway(ctx: Ctx, input: AwayInput, providers: Providers = realProviders, origin = appOrigin().origin): Promise<AwayMessage> {
  assertCan(ctx.actor, "manageDirectory");
  const now = ctx.now ?? new Date();
  const data = clean(input, now);
  const prepared = await asTenant(
    ctx.organisationId,
    async (tx) => {
      await requirePremium(tx, ctx.organisationId, "away");
      const p = await tx.person.findFirst({ where: { id: input.personId }, include: PHOTO_SELECT });
      if (!p) throw new DomainError("invalid", "Choose someone from your directory.", "personId");
      if (!p.active) throw new DomainError("invalid", "They're suspended or removed in the directory.", "personId");
      const signature = data.withSignature ? ((await new OrgRenderer(tx, ctx.organisationId, origin, now).render(p, GMAIL_CONTEXT))?.html ?? null) : null;
      await tx.awayMessage.updateMany({ where: { personId: p.id, status: { not: "CANCELLED" }, endsAt: { gt: now } }, data: { status: "CANCELLED" } });
      const row = await tx.awayMessage.create({ data: { ...data, organisationId: ctx.organisationId, personId: p.id, setBy: ctx.actor.name } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "away.set", { type: "Person", id: p.id }, { email: p.email, from: data.startsAt.toISOString(), to: data.endsAt.toISOString() }, ctx.ipAddress);
      return { row, target: await targetFor(tx, p), html: awayHtml(data.message, signature) };
    },
    ctx.db,
  );
  const { row, target, html } = prepared;
  let update: Partial<AwayMessage>;
  if (!target) {
    update = { status: "SAVED", lastError: "Tshaeno can't reach this mailbox, because they aren't synced from Google Workspace or Microsoft 365. Copy the message and set it in their mail app." };
  } else {
    try {
      await push(target, providers, { subject: data.subject, html, startsAt: data.startsAt, endsAt: data.endsAt });
      update = { status: "SET", mailbox: MAILBOX[target.kind], lastError: null };
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      update = { status: "FAILED", mailbox: MAILBOX[target.kind], lastError: e.message };
    }
  }
  return asTenant(ctx.organisationId, (tx) => tx.awayMessage.update({ where: { id: row.id }, data: update }), ctx.db);
}

/** Cancels it and, if it's in a mailbox and not over, switches it off there. */
export async function cancelAway(ctx: Ctx, awayId: string, providers: Providers = realProviders): Promise<AwayMessage> {
  assertCan(ctx.actor, "manageDirectory");
  const now = ctx.now ?? new Date();
  const found = await asTenant(
    ctx.organisationId,
    async (tx) => {
      const a = await tx.awayMessage.findFirst({ where: { id: awayId }, include: { person: true } });
      if (!a) throw new DomainError("not-found", "That out-of-office reply doesn't exist.");
      return { a, target: a.status === "SET" && a.endsAt > now ? await targetFor(tx, a.person) : null };
    },
    ctx.db,
  );
  let lastError: string | null = null;
  if (found.target) {
    try {
      await push(found.target, providers, null);
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      lastError = `Couldn't switch it off in ${MAILBOX[found.target.kind]}: ${e.message} Switch it off in their mail app.`;
    }
  }
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const a = await tx.awayMessage.update({ where: { id: awayId }, data: { status: "CANCELLED", lastError } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "away.cancelled", { type: "Person", id: a.personId }, { email: found.a.person.email }, ctx.ipAddress);
      return a;
    },
    ctx.db,
  );
}

/** Replies that are on or coming up, then the last month's, newest first. */
export async function awayList(tx: Tx, now = new Date()) {
  const rows = await tx.awayMessage.findMany({
    where: { endsAt: { gt: new Date(now.getTime() - 30 * DAY) } },
    include: { person: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { startsAt: "asc" },
    take: 200,
  });
  const order: Record<AwayState, number> = { on: 0, scheduled: 1, ended: 2, cancelled: 3 };
  return rows.map((r) => ({ ...r, state: awayState(r, now) })).sort((a, b) => order[a.state] - order[b.state]);
}

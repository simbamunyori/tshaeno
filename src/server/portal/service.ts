import type { Organisation, Person, PrismaClient } from "@prisma/client";
import { asSystem, asTenant, type Tx } from "@/server/db";
import { hashToken, looksLikeEmail, newToken, normaliseEmail } from "@/server/auth/service";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { kitData } from "@/server/signatures/brand";
import { processImage, saveAsset } from "@/server/signatures/assets";
import { cleanSocials, personSocials } from "@/server/signatures/people";
import type { SocialNetwork } from "@/lib/signature/types";

/**
 * The self-service page. People in the directory, who usually have no
 * Tshaeno account, ask for a link by email and can then change their own
 * photo and social links, within what their organisation allows.
 */

export const LINK_TTL_MS = 30 * 60 * 1000;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** No more than one link per person this often. */
const RESEND_WAIT_MS = 60 * 1000;

export const SENT_MESSAGE = "If your organisation lets you update your own signature, a link is on its way to that address. It works for 30 minutes.";

/**
 * Emails a sign-in link to each organisation where this address belongs
 * to someone who may use the page. Says the same whatever it finds, so it
 * can't be used to learn who works where.
 */
export async function requestLink(emailInput: string, db?: PrismaClient, now = new Date()): Promise<void> {
  const email = normaliseEmail(emailInput);
  if (!looksLikeEmail(email)) throw new DomainError("invalid", "Enter your work email.", "email");
  await asSystem(async (tx) => {
    const people = await tx.person.findMany({
      where: { email, active: true, organisation: { portalEnabled: true, status: "ACTIVE" } },
      select: { id: true, organisationId: true },
      take: 10,
    });
    for (const p of people) {
      const recent = await tx.portalLink.findFirst({ where: { personId: p.id, createdAt: { gt: new Date(now.getTime() - RESEND_WAIT_MS) } }, select: { id: true } });
      if (recent) continue;
      // The token itself is made when the email is sent, so only the newest email's link works.
      const link = await tx.portalLink.create({ data: { organisationId: p.organisationId, personId: p.id, linkExpiresAt: new Date(now.getTime() + LINK_TTL_MS) } });
      await tx.outboundEmail.create({ data: { kind: "portal_link", toAddress: email, payload: { linkId: link.id } } });
    }
  }, db);
}

/** A fresh token for a link about to be emailed. Null when the link is used or expired. */
export async function issueLinkToken(tx: Tx, linkId: string, now = new Date()): Promise<{ token: string; organisation: string; firstName: string } | null> {
  const link = await tx.portalLink.findUnique({ where: { id: linkId }, include: { organisation: { select: { name: true } }, person: { select: { firstName: true } } } });
  if (!link || link.sessionHash || link.linkExpiresAt <= now) return null;
  const token = newToken();
  await tx.portalLink.update({ where: { id: link.id }, data: { linkHash: hashToken(token) } });
  return { token, organisation: link.organisation.name, firstName: link.person.firstName };
}

/** Swaps an emailed link for a session. The link works once. */
export async function redeemLink(token: string, db?: PrismaClient, now = new Date()): Promise<{ session: string } | { error: string }> {
  if (!token) return { error: "This link is incomplete." };
  return asSystem(async (tx) => {
    const link = await tx.portalLink.findUnique({ where: { linkHash: hashToken(token) }, include: { organisation: true, person: true } });
    if (!link || link.sessionHash) return { error: "This link has already been used. Ask for a new one." };
    if (link.linkExpiresAt <= now) return { error: "This link has expired. Ask for a new one." };
    if (!link.organisation.portalEnabled || link.organisation.status !== "ACTIVE" || !link.person.active) return { error: "Your organisation has turned this page off." };
    const session = newToken();
    await tx.portalLink.update({ where: { id: link.id }, data: { linkHash: null, sessionHash: hashToken(session), sessionExpiresAt: new Date(now.getTime() + SESSION_TTL_MS) } });
    // Older sessions for this person end.
    await tx.portalLink.deleteMany({ where: { personId: link.personId, id: { not: link.id }, sessionHash: { not: null } } });
    return { session };
  }, db);
}

export interface PortalSession {
  linkId: string;
  person: Person & { photo: { id: string; contentType: string; width: number; height: number } | null };
  organisation: Organisation;
  /** Networks they may set: the ones their organisation's brand kits show. */
  networks: SocialNetwork[];
}

export async function portalSession(sessionToken: string | undefined, db?: PrismaClient, now = new Date()): Promise<PortalSession | null> {
  if (!sessionToken) return null;
  return asSystem(async (tx) => {
    const link = await tx.portalLink.findUnique({
      where: { sessionHash: hashToken(sessionToken) },
      include: { organisation: true, person: { include: { photo: { select: { id: true, contentType: true, width: true, height: true } } } } },
    });
    if (!link?.sessionExpiresAt || link.sessionExpiresAt <= now) return null;
    if (!link.organisation.portalEnabled || link.organisation.status !== "ACTIVE" || !link.person.active) return null;
    const kits = await tx.brandKit.findMany({ where: { organisationId: link.organisationId }, select: { data: true } });
    const networks = [...new Set(kits.flatMap((k) => kitData(k).socials.map((s) => s.network)))];
    return { linkId: link.id, person: link.person, organisation: link.organisation, networks };
  }, db);
}

const self = (s: PortalSession) => ({ userId: null, name: `${s.person.firstName} ${s.person.lastName}`.trim() + " (self-service)" });

/** They change their own social links. Links for networks they may not set are kept as they were. */
export async function saveOwnSocials(s: PortalSession, input: Partial<Record<string, string>>, db?: PrismaClient) {
  const mine = cleanSocials(input, s.networks);
  const kept = Object.fromEntries(Object.entries(personSocials(s.person)).filter(([k]) => !s.networks.includes(k as SocialNetwork)));
  const socials = { ...kept, ...mine };
  await asTenant(
    s.organisation.id,
    async (tx) => {
      await tx.person.update({ where: { id: s.person.id }, data: { socials } });
      await audit(tx, s.organisation.id, self(s), "person.socials_changed", { type: "Person", id: s.person.id }, { email: s.person.email, networks: Object.keys(mine) });
    },
    db,
  );
}

export async function setOwnPhoto(s: PortalSession, file: Buffer | null, db?: PrismaClient) {
  if (!s.organisation.portalPhoto) throw new DomainError("forbidden", "Your organisation manages photos centrally.");
  const img = file ? await processImage(file, "PHOTO") : null;
  await asTenant(
    s.organisation.id,
    async (tx) => {
      const asset = img ? await saveAsset(tx, s.organisation.id, "PHOTO", img) : null;
      await tx.person.update({ where: { id: s.person.id }, data: { photoAssetId: asset?.id ?? null } });
      await audit(tx, s.organisation.id, self(s), asset ? "person.photo_changed" : "person.photo_removed", { type: "Person", id: s.person.id }, { email: s.person.email });
    },
    db,
  );
}

export async function endSession(sessionToken: string | undefined, db?: PrismaClient) {
  if (!sessionToken) return;
  await asSystem((tx) => tx.portalLink.deleteMany({ where: { sessionHash: hashToken(sessionToken) } }), db);
}

// ─── The organisation's settings ───────────────────────────────────

export async function setPortal(ctx: { db?: PrismaClient; organisationId: string; actor: Actor; ipAddress?: string | null }, input: { enabled: boolean; photo: boolean }) {
  assertCan(ctx.actor, "manageOrganisation");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      await tx.organisation.update({ where: { id: ctx.organisationId }, data: { portalEnabled: input.enabled, portalPhoto: input.photo } });
      if (!input.enabled) await tx.portalLink.deleteMany({});
      await audit(tx, ctx.organisationId, { userId: ctx.actor.userId, name: ctx.actor.name }, "organisation.portal_changed", { type: "Organisation", id: ctx.organisationId }, input, ctx.ipAddress);
    },
    ctx.db,
  );
}

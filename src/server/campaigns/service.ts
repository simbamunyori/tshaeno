import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Audience, Campaign, PrismaClient } from "@prisma/client";
import { campaignState } from "@/lib/signature/campaigns";
import { safeHref } from "@/lib/signature/style";
import { asSystem, asTenant, type Tx } from "@/server/db";
import { env } from "@/server/env";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { processImage, saveAsset } from "@/server/signatures/assets";

/**
 * Campaign banners: a picture and a link added under signatures for a
 * while, for the people and emails chosen, with clicks counted. Gmail
 * signatures are refreshed when one starts or ends; the Outlook add-in
 * picks them up on its own.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
  now?: Date;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });
const DAY = 24 * 60 * 60 * 1000;

// ─── Click links ─────────────────────────────────────────────────────

function mac(campaignKey: string, senderId: string, secret: string): string {
  return createHmac("sha256", secret).update(`click:${campaignKey}:${senderId}`).digest("base64url").slice(0, 12);
}

/** The banner's link for one sender. It says whose email it was in, and can't be made up for someone else. */
export function clickUrl(origin: string, campaignKey: string, senderId: string, secret = env().TOTP_ENCRYPTION_KEY): string {
  return `${origin}/c/${campaignKey}/${senderId}.${mac(campaignKey, senderId, secret)}`;
}

export function senderFromToken(campaignKey: string, token: string, secret = env().TOTP_ENCRYPTION_KEY): string | null {
  const [senderId, given] = token.split(".");
  if (!senderId || !given || !/^[a-z0-9]{10,40}$/i.test(senderId)) return null;
  const a = Buffer.from(mac(campaignKey, senderId, secret));
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b) ? senderId : null;
}

/** Link checkers in mail servers open every link; their visits aren't clicks. */
const NOT_A_PERSON = /bot|crawl|spider|slurp|preview|scan|safelinks|proofpoint|mimecast|barracuda|urldefense|fetch|curl|wget|python|headless/i;

/**
 * Counts a click, once per visitor per day, and says where to send them.
 * Null when there's no such campaign.
 */
export async function recordClick(
  input: { key: string; token: string; ip: string | null; userAgent: string | null; method?: string },
  db?: PrismaClient,
  now = new Date(),
  secret = env().TOTP_ENCRYPTION_KEY,
): Promise<string | null> {
  if (!/^[a-z0-9]{8,32}$/i.test(input.key)) return null;
  const campaign = await asSystem((tx) => tx.campaign.findUnique({ where: { key: input.key }, select: { id: true, organisationId: true, linkUrl: true } }), db);
  if (!campaign) return null;
  const ua = input.userAgent ?? "";
  if (input.method === "HEAD" || !ua || NOT_A_PERSON.test(ua)) return campaign.linkUrl;
  const day = now.toISOString().slice(0, 10);
  const visitorHash = createHash("sha256").update(`${secret}|${day}|${input.ip ?? ""}|${ua}`).digest("hex").slice(0, 32);
  const senderId = senderFromToken(input.key, input.token, secret);
  await asTenant(
    campaign.organisationId,
    async (tx) => {
      const sender = senderId ? await tx.person.findFirst({ where: { id: senderId }, select: { id: true } }) : null;
      await tx.campaignClick.createMany({
        data: [{ organisationId: campaign.organisationId, campaignId: campaign.id, senderId: sender?.id ?? null, visitorHash, createdAt: now }],
        skipDuplicates: true,
      });
    },
    db,
  );
  return campaign.linkUrl;
}

// ─── What the renderer needs ────────────────────────────────────────

export type LiveCampaign = Campaign & { image: { id: string; contentType: string; width: number; height: number } };

/** Campaigns that could be showing now, with their pictures. */
export async function liveCampaigns(tx: Tx, now = new Date()): Promise<LiveCampaign[]> {
  const rows = await tx.campaign.findMany({
    where: { pausedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }], imageAssetId: { not: null } },
    include: { image: { select: { id: true, contentType: true, width: true, height: true } } },
  });
  return rows.filter((c): c is LiveCampaign => !!c.image);
}

// ─── Managing campaigns ──────────────────────────────────────────────

export interface CampaignInput {
  name: string;
  linkUrl: string;
  alt: string;
  width: number;
  startsAt: Date | null;
  endsAt: Date | null;
  scope: "EVERYONE" | "LOCATION" | "DEPARTMENT" | "GROUP";
  target: string;
  audience: Audience;
  forNew: boolean;
  forReply: boolean;
}

function clean(input: CampaignInput, now: Date) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new DomainError("invalid", "Give the campaign a name.", "name");
  if (name.length > 80) throw new DomainError("invalid", "Keep the name under 80 characters.", "name");
  const link = safeHref(input.linkUrl);
  if (!link || !/^https?:/i.test(link)) throw new DomainError("invalid", "Enter the web address the banner opens, such as https://example.com/offer.", "linkUrl");
  if (link.length > 400) throw new DomainError("invalid", "That address is too long.", "linkUrl");
  const alt = input.alt.trim();
  if (!alt) throw new DomainError("invalid", "Describe the banner in a few words, for people who don't see pictures.", "alt");
  if (alt.length > 120) throw new DomainError("invalid", "Keep the description under 120 characters.", "alt");
  if (!Number.isInteger(input.width) || input.width < 200 || input.width > 600) throw new DomainError("invalid", "Choose a width from 200 to 600 pixels.", "width");
  const startsAt = input.startsAt ?? now;
  if (input.endsAt && input.endsAt <= startsAt) throw new DomainError("invalid", "The end must be after the start.", "endsAt");
  const target = input.target.trim().slice(0, 100);
  if (input.scope !== "EVERYONE" && !target) throw new DomainError("invalid", "Say which one.", "target");
  if (!input.forNew && !input.forReply) throw new DomainError("invalid", "Choose new emails, replies or both.", "forNew");
  return {
    name,
    linkUrl: link,
    alt,
    width: input.width,
    startsAt,
    endsAt: input.endsAt,
    scope: input.scope,
    department: input.scope === "DEPARTMENT" ? target : null,
    location: input.scope === "LOCATION" ? target : null,
    groupName: input.scope === "GROUP" ? target : null,
    audience: input.audience,
    forNew: input.forNew,
    forReply: input.forReply,
  };
}

/** Whether Gmail needs refreshing for this campaign now, which the caller does. */
const pushMarks = (c: { startsAt: Date; endsAt: Date | null }, now: Date) => ({
  startPushedAt: c.startsAt <= now ? now : null,
  endPushedAt: c.endsAt && c.endsAt <= now ? now : null,
});

export async function saveCampaign(ctx: Ctx, campaignId: string | null, input: CampaignInput, image: Buffer | null) {
  assertCan(ctx.actor, "manageTemplates");
  const now = ctx.now ?? new Date();
  const data = clean(input, now);
  const img = image ? await processImage(image, "BANNER") : null;
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const before = campaignId ? await tx.campaign.findFirst({ where: { id: campaignId } }) : null;
      if (campaignId && !before) throw new DomainError("not-found", "That campaign doesn't exist.");
      if (!before && !img) throw new DomainError("invalid", "Choose the banner picture.", "file");
      const asset = img ? await saveAsset(tx, ctx.organisationId, "BANNER", img) : null;
      const fields = { ...data, ...pushMarks(data, now), ...(asset ? { imageAssetId: asset.id } : {}) };
      const c = before
        ? await tx.campaign.update({ where: { id: before.id }, data: fields })
        : await tx.campaign.create({ data: { ...fields, organisationId: ctx.organisationId, key: randomBytes(8).toString("hex") } });
      await audit(tx, ctx.organisationId, who(ctx.actor), before ? "campaign.changed" : "campaign.created", { type: "Campaign", id: c.id }, { name: c.name }, ctx.ipAddress);
      return c;
    },
    ctx.db,
  );
}

export async function setPaused(ctx: Ctx, campaignId: string, paused: boolean) {
  assertCan(ctx.actor, "manageTemplates");
  const now = ctx.now ?? new Date();
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const c = await tx.campaign.findFirst({ where: { id: campaignId } });
      if (!c) throw new DomainError("not-found", "That campaign doesn't exist.");
      await tx.campaign.update({ where: { id: c.id }, data: { pausedAt: paused ? now : null, ...(paused ? {} : pushMarks(c, now)) } });
      await audit(tx, ctx.organisationId, who(ctx.actor), paused ? "campaign.paused" : "campaign.resumed", { type: "Campaign", id: c.id }, { name: c.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

/** Ends it now. Its clicks stay in the reports. */
export async function endCampaign(ctx: Ctx, campaignId: string) {
  assertCan(ctx.actor, "manageTemplates");
  const now = ctx.now ?? new Date();
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const c = await tx.campaign.findFirst({ where: { id: campaignId } });
      if (!c) throw new DomainError("not-found", "That campaign doesn't exist.");
      if (c.endsAt && c.endsAt <= now) return;
      await tx.campaign.update({ where: { id: c.id }, data: { endsAt: now, endPushedAt: now, ...(c.startsAt > now ? { startsAt: now, startPushedAt: now } : {}) } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "campaign.ended", { type: "Campaign", id: c.id }, { name: c.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function deleteCampaign(ctx: Ctx, campaignId: string) {
  assertCan(ctx.actor, "manageTemplates");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const c = await tx.campaign.findFirst({ where: { id: campaignId } });
      if (!c) return;
      await tx.campaign.delete({ where: { id: c.id } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "campaign.deleted", { type: "Campaign", id: c.id }, { name: c.name }, ctx.ipAddress);
    },
    ctx.db,
  );
}

// ─── Scheduling ──────────────────────────────────────────────────────

/**
 * Organisations whose Gmail signatures need refreshing because a campaign
 * started or ended since the last look. Each start and end is done once.
 */
export async function campaignTick(now = new Date(), db?: PrismaClient): Promise<string[]> {
  return asSystem(async (tx) => {
    const starting = await tx.campaign.findMany({ where: { startPushedAt: null, pausedAt: null, startsAt: { lte: now } }, select: { id: true, organisationId: true } });
    const ending = await tx.campaign.findMany({ where: { endPushedAt: null, endsAt: { lte: now } }, select: { id: true, organisationId: true } });
    if (starting.length) await tx.campaign.updateMany({ where: { id: { in: starting.map((c) => c.id) } }, data: { startPushedAt: now } });
    if (ending.length) await tx.campaign.updateMany({ where: { id: { in: ending.map((c) => c.id) } }, data: { endPushedAt: now } });
    return [...new Set([...starting, ...ending].map((c) => c.organisationId))];
  }, db);
}

// ─── Reports ─────────────────────────────────────────────────────────

export interface CampaignReport {
  campaign: Campaign & { image: { id: string; contentType: string } | null };
  state: ReturnType<typeof campaignState>;
  clicks: number;
  clicks30: number;
  /** Clicks per day for the last 30 days, oldest first. */
  daily: number[];
  topSenders: { name: string; clicks: number }[];
}

export async function campaignReports(tx: Tx, now = new Date()): Promise<CampaignReport[]> {
  const since = new Date(now.getTime() - 30 * DAY);
  const [campaigns, totals, recent] = await Promise.all([
    tx.campaign.findMany({ orderBy: { startsAt: "desc" }, include: { image: { select: { id: true, contentType: true } } } }),
    tx.campaignClick.groupBy({ by: ["campaignId"], _count: { _all: true } }),
    tx.campaignClick.findMany({ where: { createdAt: { gte: since } }, select: { campaignId: true, senderId: true, createdAt: true } }),
  ]);
  const senderIds = [...new Set(recent.map((r) => r.senderId).filter((x): x is string => !!x))];
  const senders = senderIds.length ? await tx.person.findMany({ where: { id: { in: senderIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const name = new Map(senders.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]));
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 29 * DAY;
  return campaigns.map((c) => {
    const mine = recent.filter((r) => r.campaignId === c.id);
    const daily = Array.from({ length: 30 }, () => 0);
    for (const r of mine) {
      const i = Math.floor((r.createdAt.getTime() - start) / DAY);
      if (i >= 0 && i < 30) daily[i]++;
    }
    const bySender = new Map<string, number>();
    for (const r of mine) if (r.senderId && name.has(r.senderId)) bySender.set(r.senderId, (bySender.get(r.senderId) ?? 0) + 1);
    return {
      campaign: c,
      state: campaignState(c, now),
      clicks: totals.find((t) => t.campaignId === c.id)?._count._all ?? 0,
      clicks30: mine.length,
      daily,
      topSenders: [...bySender.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, clicks]) => ({ name: name.get(id)!, clicks })),
    };
  });
}

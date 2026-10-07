import type { Rendered } from "./render";
import { ruleCoversPerson, SCOPE_RANK, type Audience, type EmailContext, type RulePerson, type Scope } from "./rules";
import { escapeHtml, safeHref } from "./style";

/**
 * Campaign banners: which one, if any, goes under a person's signature
 * for one email, and how it is added. Pure, so Gmail, the Outlook add-in
 * and previews all agree.
 */

export interface CampaignRule {
  id: string;
  /** Campaigns aren't aimed at single people, so PERSON never matches. */
  scope: Scope;
  department: string | null;
  groupName: string | null;
  location: string | null;
  audience: Audience;
  forNew: boolean;
  forReply: boolean;
  startsAt: Date;
  endsAt: Date | null;
  pausedAt: Date | null;
}

export type CampaignState = "scheduled" | "running" | "paused" | "ended";

export function campaignState(c: Pick<CampaignRule, "startsAt" | "endsAt" | "pausedAt">, now: Date): CampaignState {
  if (c.endsAt && c.endsAt <= now) return "ended";
  if (c.pausedAt) return "paused";
  return c.startsAt <= now ? "running" : "scheduled";
}

/** The campaign for this email, or null. The most specific wins, then the one that started last. */
export function campaignFor<T extends CampaignRule>(person: RulePerson, campaigns: T[], ctx: EmailContext, now: Date): T | null {
  const fits = campaigns.filter(
    (c) =>
      campaignState(c, now) === "running" &&
      (ctx.compose === "new" ? c.forNew : c.forReply) &&
      (c.audience === "ANY" || c.audience.toLowerCase() === ctx.audience) &&
      ruleCoversPerson({ ...c, personId: null, templateId: "", createdAt: c.startsAt }, person),
  );
  fits.sort((a, b) => SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope] || b.startsAt.getTime() - a.startsAt.getTime());
  return fits[0] ?? null;
}

export interface Banner {
  imageUrl: string;
  /** The image's own size, to keep its shape at the shown width. */
  imageWidth: number;
  imageHeight: number;
  width: number;
  alt: string;
  href: string;
}

/** The banner in its own row under the signature, so the signature's layout never changes. */
export function withBanner(r: Rendered, b: Banner): Rendered {
  const width = Math.max(100, Math.min(600, Math.round(b.width)));
  const height = Math.max(1, Math.round((width * b.imageHeight) / Math.max(1, b.imageWidth)));
  const href = safeHref(b.href);
  const alt = escapeHtml(b.alt);
  const img = `<img src="${escapeHtml(b.imageUrl)}" width="${width}" height="${height}" alt="${alt}" style="display:block;border:0;outline:none;text-decoration:none;width:${width}px;max-width:100%;height:auto">`;
  const html =
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse"><tr><td>${r.html}</td></tr>` +
    `<tr><td style="padding:12px 0 0 0">${href ? `<a href="${escapeHtml(href)}" target="_blank" style="text-decoration:none">${img}</a>` : img}</td></tr></table>`;
  return { html, text: href ? `${r.text}\n\n${b.alt}: ${href}` : r.text };
}

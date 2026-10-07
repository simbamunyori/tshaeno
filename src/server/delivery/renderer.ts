import { createHash } from "node:crypto";
import type { Person } from "@prisma/client";
import type { Tx } from "@/server/db";
import { withBadge } from "@/lib/signature/badge";
import { campaignFor, withBanner } from "@/lib/signature/campaigns";
import { clickUrl, liveCampaigns, type LiveCampaign } from "@/server/campaigns/service";
import { assetUrl } from "@/server/signatures/assets";
import { renderHtmlSignature } from "@/lib/signature/html-mode";
import { badgeFor } from "@/server/billing/badge";
import { renderSignature, type Rendered } from "@/lib/signature/render";
import { signatureFor, type EmailContext, type Rule } from "@/lib/signature/rules";
import type { BrandData, TemplateContent } from "@/lib/signature/types";
import { kitFor, toBrandData } from "@/server/signatures/brand";
import { toPersonData } from "@/server/signatures/people";
import { assetsFor, contentOf, liveRules } from "@/server/signatures/templates";

export type PersonForRender = Person & { photo: { id: string; contentType: string; width: number; height: number } | null };

export interface RenderedFor extends Rendered {
  templateId: string;
  hash: string;
}

export const hashHtml = (html: string) => createHash("sha256").update(html).digest("hex");

/**
 * Renders many people's signatures inside one organisation's transaction,
 * reading each published template, brand kit and image list only once.
 */
export class OrgRenderer {
  private rules: Rule[] | null = null;
  private badge: Promise<string | null> | null = null;
  private campaigns: Promise<LiveCampaign[]> | null = null;
  private templates = new Map<string, Promise<{ content: TemplateContent; brand: BrandData; assets: Awaited<ReturnType<typeof assetsFor>> } | null>>();

  constructor(
    private readonly tx: Tx,
    private readonly organisationId: string,
    private readonly origin: string,
    private readonly now = new Date(),
  ) {}

  async templateFor(person: Pick<Person, "id" | "department" | "location" | "groups">, ctx: EmailContext): Promise<string | null> {
    this.rules ??= await liveRules(this.tx);
    return signatureFor(person, this.rules, ctx);
  }

  private template(templateId: string) {
    let hit = this.templates.get(templateId);
    if (!hit) {
      hit = (async () => {
        const t = await this.tx.signatureTemplate.findFirst({ where: { id: templateId }, include: { published: true } });
        if (!t?.published) return null;
        const brand = toBrandData(await kitFor(this.tx, this.organisationId, t.brandKitId), this.origin);
        const content = contentOf(t.published.kind, t.published.content);
        const assets = content.kind === "VISUAL" ? await assetsFor(this.tx, content.doc, this.origin) : {};
        return { content, brand, assets };
      })();
      this.templates.set(templateId, hit);
    }
    return hit;
  }

  /** This person's signature for this kind of email, or null when no rule gives them one. */
  async render(person: PersonForRender, ctx: EmailContext): Promise<RenderedFor | null> {
    const templateId = await this.templateFor(person, ctx);
    if (!templateId) return null;
    const t = await this.template(templateId);
    if (!t) return null;
    const data = toPersonData(person, this.origin);
    const signature =
      t.content.kind === "HTML"
        ? renderHtmlSignature(t.content.html, { brand: t.brand, person: data })
        : renderSignature(t.content.doc, { brand: t.brand, person: data, assets: t.assets, origin: this.origin });
    this.campaigns ??= liveCampaigns(this.tx, this.now);
    const campaign = campaignFor(person, await this.campaigns, ctx, this.now);
    const withCampaign = campaign
      ? withBanner(signature, {
          imageUrl: assetUrl(this.origin, campaign.image),
          imageWidth: campaign.image.width,
          imageHeight: campaign.image.height,
          width: campaign.width,
          alt: campaign.alt,
          href: clickUrl(this.origin, campaign.key, person.id),
        })
      : signature;
    this.badge ??= badgeFor(this.tx, this.organisationId);
    const badge = await this.badge;
    const out = badge ? withBadge(withCampaign, badge) : withCampaign;
    return { ...out, templateId, hash: hashHtml(out.html) };
  }
}

/** Notes when an organisation's first signature went live, to measure getting started. */
export async function markFirstSignature(tx: Tx, organisationId: string, at: Date) {
  await tx.organisation.updateMany({ where: { id: organisationId, firstSignatureAt: null }, data: { firstSignatureAt: at } });
}

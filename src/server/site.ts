import type { Currency } from "@prisma/client";
import type { Starter } from "@/lib/signature/starters";
import { type PreviewInput, previewHtml } from "@/lib/site/preview";
import type { Palette } from "@/lib/site/samples";
import type { Price } from "@/lib/billing/plans";
import { asSystem } from "@/server/db";
import { env } from "@/server/env";
import { origin } from "@/server/signatures/studio-data";

/** A starter filled in with the made-up company for its industry, for the website. */
export function sampleHtml(s: Starter, p: Palette, input: PreviewInput = {}): string {
  return previewHtml(s.doc, p, origin(), { industry: s.industry, graphic: s.graphic ? "sample" : null, ...input });
}

/** The public price list in one currency. Prices aren't tenant data, so this reads them as the system. */
export async function publicPrices(currency: Currency): Promise<Price[]> {
  return asSystem((tx) => tx.planPrice.findMany({ where: { currency }, select: { tier: true, currency: true, monthlyMinor: true, annualMinor: true } }));
}

export function salesEmail(): string | null {
  return env().SALES_EMAIL ?? null;
}

export function marketplaceUrl(): string | null {
  return env().FOURTHGEN_MARKETPLACE_URL ?? null;
}

/** The cookie that carries a template picked on the website through sign-up. */
export const PICKED_TEMPLATE_COOKIE = "tshaeno_template";

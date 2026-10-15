import type { Currency } from "@prisma/client";
import { renderSignature } from "@/lib/signature/render";
import type { SignatureDoc } from "@/lib/signature/types";
import { type Palette, type SampleInput, sampleBrand, samplePerson } from "@/lib/site/samples";
import type { Price } from "@/lib/billing/plans";
import { asSystem } from "@/server/db";
import { env } from "@/server/env";
import { origin } from "@/server/signatures/studio-data";

/** A template filled in with a made-up company, for the website. */
export function sampleHtml(doc: SignatureDoc, p: Palette, input: SampleInput = {}): string {
  return renderSignature(doc, { brand: sampleBrand(p, input), person: samplePerson(p, input), assets: {}, origin: origin() }).html;
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

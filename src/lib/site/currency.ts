import { CURRENCIES, type Currency } from "@/lib/billing/plans";

/**
 * The currency a website visitor sees prices in. An explicit choice wins,
 * then the country a CDN or proxy put in a header, then the region in the
 * browser's language, then US dollars.
 */

const COUNTRY_CURRENCY: Record<string, Currency> = {
  BW: "BWP",
  ZA: "ZAR",
  // The rand is legal tender in the Common Monetary Area.
  LS: "ZAR",
  SZ: "ZAR",
  NA: "ZAR",
};

/** Headers that carry the visitor's country, in the order we trust them. */
export const COUNTRY_HEADERS = ["cf-ipcountry", "cloudfront-viewer-country", "x-vercel-ip-country", "x-country-code"] as const;

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as string[]).includes(v);
}

export function currencyForCountry(country: string | null | undefined): Currency | null {
  if (!country) return null;
  return COUNTRY_CURRENCY[country.trim().toUpperCase()] ?? null;
}

/** en-BW, tn-BW or af-ZA give a country; plain "en" gives nothing. */
export function countryFromLanguages(acceptLanguage: string | null | undefined): string | null {
  if (!acceptLanguage) return null;
  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0].trim();
    const m = /^[a-z]{2,3}-([a-z]{2})\b/i.exec(tag);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export interface CurrencyChoice {
  currency: Currency;
  /** Where it came from, so the page can say "Prices in rand, based on your location." */
  source: "chosen" | "location" | "language" | "default";
}

export function visitorCurrency(headers: Pick<Headers, "get">, chosen?: string | null): CurrencyChoice {
  const pick = chosen?.toUpperCase();
  if (isCurrency(pick)) return { currency: pick, source: "chosen" };
  for (const h of COUNTRY_HEADERS) {
    const value = headers.get(h);
    if (value) {
      // A known country outside the region means dollars, not a guess from the language.
      return { currency: currencyForCountry(value) ?? "USD", source: "location" };
    }
  }
  const fromLanguage = currencyForCountry(countryFromLanguages(headers.get("accept-language")));
  if (fromLanguage) return { currency: fromLanguage, source: "language" };
  return { currency: "USD", source: "default" };
}

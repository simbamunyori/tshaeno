/**
 * Plans and prices. Plain functions shared by the server, the billing
 * page and the platform admin area. Money is always whole cents (thebe
 * for BWP) in integers, never floating point.
 */

export type PlanTier = "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE";
export type Currency = "BWP" | "ZAR" | "USD";
export type BillingInterval = "MONTHLY" | "ANNUAL";

export const TIERS: PlanTier[] = ["STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"];
export const CURRENCIES: Currency[] = ["BWP", "ZAR", "USD"];

export const TIER_LABEL: Record<PlanTier, string> = { STARTER: "Starter", GROWTH: "Growth", BUSINESS: "Business", ENTERPRISE: "Enterprise" };

/** People each band covers. Enterprise has no top. */
export const TIER_RANGE: Record<PlanTier, { min: number; max: number | null }> = {
  STARTER: { min: 1, max: 15 },
  GROWTH: { min: 16, max: 100 },
  BUSINESS: { min: 101, max: 999 },
  ENTERPRISE: { min: 1000, max: null },
};

export const CURRENCY_LABEL: Record<Currency, string> = { BWP: "Botswana pula", ZAR: "South African rand", USD: "US dollars" };

export const TRIAL_DAYS = 14;
/** The free option is Starter, so it covers this many people. */
export const FREE_PEOPLE = TIER_RANGE.STARTER.max!;
/** How long a lapsed renewal keeps everything working before the plan drops to free. */
export const GRACE_DAYS = 14;
/** How early a renewal invoice is issued. */
export const RENEWAL_NOTICE_DAYS = 7;
/** How long a new invoice can be paid in. */
export const PAYMENT_TERMS_DAYS = 7;

export const DAY = 86_400_000;

export function tierFor(people: number): PlanTier {
  if (people <= TIER_RANGE.STARTER.max!) return "STARTER";
  if (people <= TIER_RANGE.GROWTH.max!) return "GROWTH";
  if (people <= TIER_RANGE.BUSINESS.max!) return "BUSINESS";
  return "ENTERPRISE";
}

export function rangeLabel(tier: PlanTier): string {
  const r = TIER_RANGE[tier];
  return r.max ? `${r.min === 1 ? 2 : r.min} to ${r.max.toLocaleString("en-US")} people` : `${r.min.toLocaleString("en-US")} people or more`;
}

const SYMBOL: Record<Currency, string> = { BWP: "P", ZAR: "R", USD: "$" };

/** P1,234.50, R27.00 or $1.50. */
export function formatMoney(minor: number, currency: Currency): string {
  const sign = minor < 0 ? "-" : "";
  const n = (Math.abs(minor) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${SYMBOL[currency]}${n}`;
}

/** Reads "12.50" or "12" as cents. Null when it isn't a price. */
export function parseMoney(input: string): number | null {
  const t = input.trim().replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export interface Price {
  tier: PlanTier;
  currency: Currency;
  monthlyMinor: number;
  annualMinor: number;
}

/** Per person per month, for this band, currency and interval. Null when it is by quote only. */
export function unitPrice(prices: Price[], tier: PlanTier, currency: Currency, interval: BillingInterval, customMinor?: number | null): number | null {
  if (customMinor != null) return customMinor;
  const p = prices.find((x) => x.tier === tier && x.currency === currency);
  if (!p) return null;
  return interval === "ANNUAL" ? p.annualMinor : p.monthlyMinor;
}

export const monthsIn = (interval: BillingInterval) => (interval === "ANNUAL" ? 12 : 1);

/** What one period costs. */
export function periodPrice(unitMinor: number, seats: number, interval: BillingInterval): number {
  return unitMinor * seats * monthsIn(interval);
}

/** The same calendar day `months` later, or the month's last day when it has no such day. */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export const periodEndFrom = (start: Date, interval: BillingInterval) => addMonths(start, monthsIn(interval));

/**
 * The charge for adding people part way through a period: their share of
 * the period price for the time left, rounded to the cent.
 */
export function prorate(extraSeats: number, unitMinor: number, interval: BillingInterval, periodStart: Date, periodEnd: Date, now: Date): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  const left = Math.max(0, periodEnd.getTime() - now.getTime());
  if (total <= 0 || extraSeats <= 0) return 0;
  return Math.round((periodPrice(unitMinor, extraSeats, interval) * left) / total);
}

/** How much annual billing saves over twelve monthly payments, as a whole percentage. */
export function annualSaving(p: Pick<Price, "monthlyMinor" | "annualMinor">): number {
  if (p.monthlyMinor <= 0) return 0;
  return Math.round((1 - p.annualMinor / p.monthlyMinor) * 100);
}

/** The default currency for an organisation in this time zone. */
export function currencyForTimeZone(timeZone: string): Currency {
  if (timeZone === "Africa/Gaborone") return "BWP";
  if (timeZone === "Africa/Johannesburg" || timeZone === "Africa/Maseru" || timeZone === "Africa/Mbabane") return "ZAR";
  return "USD";
}

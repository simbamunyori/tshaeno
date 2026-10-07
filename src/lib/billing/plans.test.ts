import { describe, expect, it } from "vitest";
import { addMonths, annualSaving, currencyForTimeZone, formatMoney, parseMoney, periodPrice, prorate, rangeLabel, tierFor, unitPrice, type Price } from "./plans";

const PRICES: Price[] = [
  { tier: "STARTER", currency: "USD", monthlyMinor: 150, annualMinor: 125 },
  { tier: "GROWTH", currency: "BWP", monthlyMinor: 1700, annualMinor: 1417 },
];

describe("plans", () => {
  it("puts people in the right band", () => {
    expect([1, 2, 15, 16, 100, 101, 999, 1000, 25_000].map(tierFor)).toEqual(["STARTER", "STARTER", "STARTER", "GROWTH", "GROWTH", "BUSINESS", "BUSINESS", "ENTERPRISE", "ENTERPRISE"]);
    expect(rangeLabel("STARTER")).toBe("2 to 15 people");
    expect(rangeLabel("ENTERPRISE")).toBe("1,000 people or more");
  });

  it("formats and reads money in cents", () => {
    expect(formatMoney(123450, "BWP")).toBe("P1,234.50");
    expect(formatMoney(2700, "ZAR")).toBe("R27.00");
    expect(formatMoney(150, "USD")).toBe("$1.50");
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("1,200")).toBe(120000);
    expect(parseMoney("0.07")).toBe(7);
    for (const bad of ["", "-1", "1.234", "abc", "1e5"]) expect(parseMoney(bad), bad).toBeNull();
  });

  it("prices a period, and uses an agreed price when there is one", () => {
    expect(unitPrice(PRICES, "STARTER", "USD", "MONTHLY")).toBe(150);
    expect(unitPrice(PRICES, "STARTER", "USD", "ANNUAL")).toBe(125);
    expect(unitPrice(PRICES, "ENTERPRISE", "USD", "MONTHLY")).toBeNull();
    expect(unitPrice(PRICES, "ENTERPRISE", "USD", "MONTHLY", 60)).toBe(60);
    expect(periodPrice(125, 10, "ANNUAL")).toBe(15000);
    expect(periodPrice(1700, 20, "MONTHLY")).toBe(34000);
    expect(annualSaving(PRICES[0])).toBe(17);
  });

  it("adds months without running into the next one", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2026-10-07T00:00:00Z"), 12).toISOString()).toBe("2027-10-07T00:00:00.000Z");
    expect(addMonths(new Date("2028-03-31T00:00:00Z"), -1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("charges added people for the time left", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-31T00:00:00Z");
    expect(prorate(4, 150, "MONTHLY", start, end, new Date("2026-01-16T00:00:00Z"))).toBe(300);
    expect(prorate(4, 150, "MONTHLY", start, end, end)).toBe(0);
    expect(prorate(0, 150, "MONTHLY", start, end, start)).toBe(0);
  });

  it("picks a currency from the time zone", () => {
    expect(currencyForTimeZone("Africa/Gaborone")).toBe("BWP");
    expect(currencyForTimeZone("Africa/Johannesburg")).toBe("ZAR");
    expect(currencyForTimeZone("Europe/London")).toBe("USD");
  });
});

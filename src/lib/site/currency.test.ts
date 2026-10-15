import { describe, expect, it } from "vitest";
import { countryFromLanguages, visitorCurrency } from "./currency";

const h = (o: Record<string, string>) => new Headers(o);

describe("visitorCurrency", () => {
  it("prefers an explicit choice", () => {
    expect(visitorCurrency(h({ "cf-ipcountry": "BW" }), "zar")).toEqual({ currency: "ZAR", source: "chosen" });
  });
  it("ignores a choice that isn't a currency", () => {
    expect(visitorCurrency(h({ "cf-ipcountry": "BW" }), "EUR").currency).toBe("BWP");
  });
  it("uses the country header", () => {
    expect(visitorCurrency(h({ "cf-ipcountry": "za" }))).toEqual({ currency: "ZAR", source: "location" });
    expect(visitorCurrency(h({ "x-vercel-ip-country": "NA" })).currency).toBe("ZAR");
    expect(visitorCurrency(h({ "cloudfront-viewer-country": "GB", "accept-language": "en-BW" }))).toEqual({ currency: "USD", source: "location" });
  });
  it("falls back to the browser language, then dollars", () => {
    expect(visitorCurrency(h({ "accept-language": "tn-BW,en;q=0.8" }))).toEqual({ currency: "BWP", source: "language" });
    expect(visitorCurrency(h({ "accept-language": "en-US,en;q=0.9" }))).toEqual({ currency: "USD", source: "default" });
    expect(visitorCurrency(h({}))).toEqual({ currency: "USD", source: "default" });
  });
});

describe("countryFromLanguages", () => {
  it("reads the first tag with a region", () => {
    expect(countryFromLanguages("en, af-ZA;q=0.7")).toBe("ZA");
    expect(countryFromLanguages("en")).toBeNull();
    expect(countryFromLanguages("zh-Hant-TW")).toBeNull();
  });
});

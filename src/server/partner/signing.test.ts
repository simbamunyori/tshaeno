import { describe, expect, it } from "vitest";
import { newKeyId, newSecret, sign, signatureMatches, signedString, timestampFresh } from "./signing";

describe("partner request signing", () => {
  const secret = "ps_test";
  const ts = "1791374400";

  it("signs the time, method, path and body hash", () => {
    expect(signedString(ts, "post", "/api/partner/v1/organisations", "")).toBe(
      `${ts}\nPOST\n/api/partner/v1/organisations\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
    );
    expect(sign(secret, ts, "GET", "/x", "")).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it("rejects any change to what was signed", () => {
    const sig = sign(secret, ts, "POST", "/a", "{}");
    expect(signatureMatches(secret, sig, ts, "POST", "/a", "{}")).toBe(true);
    expect(signatureMatches(secret, sig, ts, "POST", "/b", "{}")).toBe(false);
    expect(signatureMatches(secret, sig, ts, "PATCH", "/a", "{}")).toBe(false);
    expect(signatureMatches(secret, sig, ts, "POST", "/a", '{"x":1}')).toBe(false);
    expect(signatureMatches(secret, sig, "1791374401", "POST", "/a", "{}")).toBe(false);
    expect(signatureMatches("ps_other", sig, ts, "POST", "/a", "{}")).toBe(false);
    expect(signatureMatches(secret, "v1=short", ts, "POST", "/a", "{}")).toBe(false);
  });

  it("allows five minutes of clock difference", () => {
    const now = new Date(Number(ts) * 1000);
    expect(timestampFresh(ts, now)).toBe(true);
    expect(timestampFresh(String(Number(ts) - 300), now)).toBe(true);
    expect(timestampFresh(String(Number(ts) + 301), now)).toBe(false);
    expect(timestampFresh("soon", now)).toBe(false);
    expect(timestampFresh(`${ts}000`, now)).toBe(false);
  });

  it("makes keys and secrets that look like what the docs say", () => {
    expect(newKeyId()).toMatch(/^pk_[0-9a-f]{18}$/);
    expect(newSecret()).toMatch(/^ps_[A-Za-z0-9_-]{43}$/);
  });
});

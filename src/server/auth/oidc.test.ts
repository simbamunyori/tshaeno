import { describe, expect, it } from "vitest";
import { assertClaims, authorizeUrl, newFlow, providerConfig } from "./oidc";

const creds = { GOOGLE_CLIENT_ID: "g-id", GOOGLE_CLIENT_SECRET: "g", MICROSOFT_CLIENT_ID: "m-id", MICROSOFT_CLIENT_SECRET: "m" };
const TID = "72f988bf-86f1-41af-91ab-2d7cd011db47";

describe("OpenID Connect", () => {
  it("is off for a provider without credentials", () => {
    expect(providerConfig("google", {})).toBeNull();
    expect(providerConfig("github", creds)).toBeNull();
  });

  it("asks for the code with PKCE, state and nonce", () => {
    const config = providerConfig("google", creds)!;
    const flow = newFlow("GOOGLE", "sign-in", "/app");
    const url = new URL(authorizeUrl(config, flow, "https://app.example/auth/google/callback"));
    expect(url.searchParams.get("state")).toBe(flow.state);
    expect(url.searchParams.get("nonce")).toBe(flow.nonce);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).not.toBe(flow.verifier);
  });

  it("checks the issuer and nonce", () => {
    const google = providerConfig("google", creds)!;
    const flow = newFlow("GOOGLE", "sign-in", null);
    expect(() => assertClaims(google, flow, { iss: "https://accounts.google.com", nonce: flow.nonce, sub: "1" })).not.toThrow();
    expect(() => assertClaims(google, flow, { iss: "https://evil.example", nonce: flow.nonce, sub: "1" })).toThrow(/issuer/);
    expect(() => assertClaims(google, flow, { iss: "https://accounts.google.com", nonce: "other", sub: "1" })).toThrow(/nonce/);
  });

  it("insists a Microsoft token's issuer names its own tenant", () => {
    const ms = providerConfig("microsoft", creds)!;
    const flow = newFlow("MICROSOFT", "sign-in", null);
    const iss = `https://login.microsoftonline.com/${TID}/v2.0`;
    expect(() => assertClaims(ms, flow, { iss, tid: TID, nonce: flow.nonce, sub: "1" })).not.toThrow();
    expect(() => assertClaims(ms, flow, { iss, tid: "00000000-0000-0000-0000-000000000000", nonce: flow.nonce, sub: "1" })).toThrow(/issuer/);
  });

  it("never treats a Microsoft email as verified", () => {
    const ms = providerConfig("microsoft", creds)!;
    expect(ms.identity({ tid: TID, oid: "abc", email: "a@b.example", name: "A" })).toEqual({
      provider: "MICROSOFT",
      subject: `${TID}:abc`,
      email: "a@b.example",
      emailVerified: false,
      name: "A",
    });
    const google = providerConfig("google", creds)!;
    expect(google.identity({ sub: "1", email: "a@gmail.com", email_verified: true }).emailVerified).toBe(true);
    expect(google.identity({ sub: "1", email: "a@gmail.com", email_verified: "true" }).emailVerified).toBe(false);
  });
});

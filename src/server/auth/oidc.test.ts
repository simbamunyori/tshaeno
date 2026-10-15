import { describe, expect, it } from "vitest";
import { assertClaims, authorizeUrl, discover, newFlow, providerConfig } from "./oidc";

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

  describe("the Fourth Generation console", () => {
    const fg = { FOURTHGEN_OIDC_ISSUER: "https://console.fg.example/", FOURTHGEN_CLIENT_ID: "fg-id", FOURTHGEN_CLIENT_SECRET: "fg" };
    const doc = {
      issuer: "https://console.fg.example",
      authorization_endpoint: "https://console.fg.example/oauth/authorize",
      token_endpoint: "https://console.fg.example/oauth/token",
      jwks_uri: "https://console.fg.example/oauth/jwks",
    };
    const serve = (body: unknown, seen: string[] = []) =>
      (async (url: string | URL | Request) => {
        seen.push(String(url));
        return Response.json(body);
      }) as typeof fetch;

    it("is off until its issuer, id and secret are all set", () => {
      expect(providerConfig("fourthgen", { ...fg, FOURTHGEN_OIDC_ISSUER: undefined })).toBeNull();
      expect(providerConfig("fourthgen", fg)?.provider).toBe("FOURTHGEN");
    });

    it("finds its endpoints in the discovery document", async () => {
      const seen: string[] = [];
      const config = await discover(providerConfig("fourthgen", fg)!, serve(doc, seen), 1);
      expect(seen).toEqual(["https://console.fg.example/.well-known/openid-configuration"]);
      expect(config).toMatchObject({ authorizeUrl: doc.authorization_endpoint, tokenUrl: doc.token_endpoint, jwksUrl: doc.jwks_uri });
      const url = new URL(authorizeUrl(config, newFlow("FOURTHGEN", "sign-in", null), "https://app.example/auth/fourthgen/callback"));
      expect(url.origin + url.pathname).toBe(doc.authorization_endpoint);
    });

    it("refuses a discovery document for another issuer or without https", async () => {
      const other = { FOURTHGEN_OIDC_ISSUER: "https://other.fg.example", FOURTHGEN_CLIENT_ID: "x", FOURTHGEN_CLIENT_SECRET: "y" };
      await expect(discover(providerConfig("fourthgen", other)!, serve(doc), 1)).rejects.toThrow(/another issuer/);
      const plain = { FOURTHGEN_OIDC_ISSUER: "https://plain.fg.example", FOURTHGEN_CLIENT_ID: "x", FOURTHGEN_CLIENT_SECRET: "y" };
      await expect(
        discover(providerConfig("fourthgen", plain)!, serve({ ...doc, issuer: "https://plain.fg.example", token_endpoint: "http://plain.fg.example/token" }), 1),
      ).rejects.toThrow(/incomplete/);
    });

    it("trusts the console's verified email, and checks its issuer", () => {
      const config = providerConfig("fourthgen", fg)!;
      const flow = newFlow("FOURTHGEN", "sign-in", null);
      expect(() => assertClaims(config, flow, { iss: "https://console.fg.example", nonce: flow.nonce, sub: "u1" })).not.toThrow();
      expect(() => assertClaims(config, flow, { iss: "https://evil.example", nonce: flow.nonce, sub: "u1" })).toThrow(/issuer/);
      expect(config.identity({ sub: "u1", email: "a@b.example", email_verified: true })).toMatchObject({ provider: "FOURTHGEN", subject: "u1", emailVerified: true });
      expect(config.identity({ sub: "u1", email: "a@b.example" }).emailVerified).toBe(false);
    });
  });
});

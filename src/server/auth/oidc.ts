import { createHash, randomBytes } from "node:crypto";
import type { IdentityProvider } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { VerifiedIdentity } from "./service";

/**
 * Sign in with Google and Microsoft: OpenID Connect authorisation code
 * flow with PKCE, state and nonce. The id_token's signature, issuer,
 * audience, expiry and nonce are all checked before anything is trusted.
 */

export interface ProviderConfig {
  provider: IdentityProvider;
  authorizeUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  /** True when the token's issuer is one this provider uses. */
  issuerOk: (iss: string, payload: JWTPayload) => boolean;
  identity: (payload: JWTPayload) => VerifiedIdentity;
}

const MICROSOFT_ISSUER = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/;

export function providerConfig(
  slug: string,
  creds: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; MICROSOFT_CLIENT_ID?: string; MICROSOFT_CLIENT_SECRET?: string },
): ProviderConfig | null {
  if (slug === "google" && creds.GOOGLE_CLIENT_ID && creds.GOOGLE_CLIENT_SECRET) {
    return {
      provider: "GOOGLE",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
      scope: "openid email profile",
      clientId: creds.GOOGLE_CLIENT_ID,
      clientSecret: creds.GOOGLE_CLIENT_SECRET,
      issuerOk: (iss) => iss === "https://accounts.google.com" || iss === "accounts.google.com",
      identity: (p) => ({
        provider: "GOOGLE",
        subject: String(p.sub),
        email: String(p.email ?? ""),
        emailVerified: p.email_verified === true,
        name: String(p.name ?? ""),
      }),
    };
  }
  if (slug === "microsoft" && creds.MICROSOFT_CLIENT_ID && creds.MICROSOFT_CLIENT_SECRET) {
    return {
      provider: "MICROSOFT",
      authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      jwksUrl: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
      scope: "openid email profile",
      clientId: creds.MICROSOFT_CLIENT_ID,
      clientSecret: creds.MICROSOFT_CLIENT_SECRET,
      // The common endpoint signs for every tenant; the issuer must name
      // the same tenant as the token's tid claim.
      issuerOk: (iss, p) => MICROSOFT_ISSUER.exec(iss)?.[1] === p.tid,
      identity: (p) => ({
        provider: "MICROSOFT",
        // oid is the person's id within their tenant; together they are unique.
        subject: `${String(p.tid)}:${String(p.oid ?? p.sub)}`,
        email: String(p.email ?? p.preferred_username ?? ""),
        // Entra lets a tenant admin put any address on an account, so it is
        // never treated as proof of ownership.
        emailVerified: false,
        name: String(p.name ?? ""),
      }),
    };
  }
  return null;
}

/** Holds the flow between leaving for the provider and coming back. */
export const OIDC_COOKIE = "tshaeno_oidc";

export interface FlowState {
  provider: IdentityProvider;
  state: string;
  nonce: string;
  verifier: string;
  intent: "sign-in" | "link";
  next: string | null;
}

export function newFlow(provider: IdentityProvider, intent: FlowState["intent"], next: string | null): FlowState {
  const r = () => randomBytes(32).toString("base64url");
  return { provider, state: r(), nonce: r(), verifier: r(), intent, next };
}

export function authorizeUrl(config: ProviderConfig, flow: FlowState, redirectUri: string): string {
  const challenge = createHash("sha256").update(flow.verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: config.scope,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Swaps the code for tokens and returns who the provider says this is. */
export async function finishFlow(
  config: ProviderConfig,
  flow: FlowState,
  code: string,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedIdentity> {
  const res = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: flow.verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed with ${res.status}.`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("The provider sent no id_token.");

  let jwks = jwksCache.get(config.jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(config.jwksUrl));
    jwksCache.set(config.jwksUrl, jwks);
  }
  const { payload } = await jwtVerify(body.id_token, jwks, { audience: config.clientId, clockTolerance: 60 });
  assertClaims(config, flow, payload);
  return config.identity(payload);
}

/** The checks jwtVerify can't make on its own. Exported for tests. */
export function assertClaims(config: ProviderConfig, flow: FlowState, payload: JWTPayload) {
  if (!payload.iss || !config.issuerOk(payload.iss, payload)) throw new Error("Unexpected token issuer.");
  if (payload.nonce !== flow.nonce) throw new Error("Token nonce doesn't match.");
  if (!payload.sub) throw new Error("Token has no subject.");
}

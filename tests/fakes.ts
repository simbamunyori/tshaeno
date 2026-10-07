/**
 * Stand-ins for Google and Microsoft: real clients talking to in-memory
 * servers through a fake fetch, so tests exercise the same requests,
 * paging and error handling the app uses.
 */
import { createHash, createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import { createLocalJWKSet, SignJWT, type JWK, type JWTVerifyGetKey } from "jose";
import { GoogleClient, type ServiceAccount } from "../src/server/connections/google";
import { MicrosoftClient, redeemConsent, type ConsentFlow } from "../src/server/connections/microsoft";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

export const TEST_SA: ServiceAccount = {
  clientEmail: "tshaeno@tshaeno-test.iam.gserviceaccount.com",
  clientId: "109876543210987654321",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export interface FakeGoogleUser {
  id: string;
  primaryEmail: string;
  name?: { givenName?: string; familyName?: string };
  suspended?: boolean;
  organizations?: { title?: string; department?: string; location?: string; primary?: boolean }[];
  phones?: { value: string; type: string }[];
  customSchemas?: Record<string, Record<string, unknown>>;
}

export class FakeGoogle {
  users: FakeGoogleUser[] = [];
  groups: { email: string; name: string; members: string[] }[] = [];
  /** Scopes delegation allows. */
  allowed = new Set(["https://www.googleapis.com/auth/admin.directory.user.readonly", "https://www.googleapis.com/auth/admin.directory.group.readonly", "https://www.googleapis.com/auth/gmail.settings.basic"]);
  admins = new Set(["admin@kalahari.example"]);
  /** Signatures set, by email. */
  signatures = new Map<string, string>();
  /** Make the next n signature updates fail with this status. */
  failNext: { count: number; status: number; message: string } | null = null;
  pageSize = 2;
  requests: string[] = [];

  private tokens = new Map<string, { sub: string; scope: string }>();

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    this.requests.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.hostname === "oauth2.test") return this.token(String(init?.body));
    const auth = new Headers(init?.headers).get("authorization")?.replace("Bearer ", "") ?? "";
    const who = this.tokens.get(auth);
    if (!who) return json(401, { error: { code: 401, message: "Invalid Credentials" } });
    const page = <T,>(list: T[], key: string) => {
      const start = Number(url.searchParams.get("pageToken") ?? 0);
      const max = Number(url.searchParams.get("maxResults") ?? this.pageSize);
      const size = Math.min(max, this.pageSize);
      const next = start + size < list.length ? String(start + size) : undefined;
      return json(200, { [key]: list.slice(start, start + size), nextPageToken: next });
    };
    if (url.pathname.startsWith("/admin/directory/v1/")) {
      if (!this.admins.has(who.sub)) return json(403, { error: { code: 403, message: "Not Authorized to access this resource/api" } });
      const m = /^\/admin\/directory\/v1\/groups\/([^/]+)\/members$/.exec(url.pathname);
      if (m) {
        const g = this.groups.find((x) => x.email === decodeURIComponent(m[1]));
        return page((g?.members ?? []).map((email) => ({ email, type: "USER" })), "members");
      }
      if (url.pathname.endsWith("/users")) return page(this.users, "users");
      if (url.pathname.endsWith("/groups")) return page(this.groups.map((g) => ({ email: g.email, name: g.name })), "groups");
    }
    const send = /^\/gmail\/v1\/users\/me\/settings\/sendAs(?:\/([^/]+))?$/.exec(url.pathname);
    if (send) {
      if (!send[1]) return json(200, { sendAs: [{ sendAsEmail: who.sub, isPrimary: true }] });
      if (this.failNext && this.failNext.count > 0) {
        this.failNext.count--;
        return json(this.failNext.status, { error: { code: this.failNext.status, message: this.failNext.message } });
      }
      const email = decodeURIComponent(send[1]);
      if (email !== who.sub) return json(403, { error: { code: 403, message: "Delegation denied" } });
      this.signatures.set(email, (JSON.parse(String(init?.body)) as { signature: string }).signature);
      return json(200, { sendAsEmail: email });
    }
    return json(404, { error: { code: 404, message: "Not found" } });
  };

  private token(body: string): Response {
    const assertion = new URLSearchParams(body).get("assertion") ?? "";
    const [h, c, sig] = assertion.split(".");
    const verify = createVerify("RSA-SHA256");
    verify.update(`${h}.${c}`);
    if (!verify.verify(publicKey, Buffer.from(sig, "base64url"))) return json(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString()) as { sub: string; scope: string; iss: string };
    if (claims.iss !== TEST_SA.clientEmail) return json(400, { error: "invalid_grant", error_description: "Invalid issuer" });
    if (!this.allowed.has(claims.scope)) {
      return json(401, { error: "unauthorized_client", error_description: "Client is unauthorized to retrieve access tokens using this method, or client not authorized for any of the scopes requested." });
    }
    const known = this.admins.has(claims.sub) || this.users.some((u) => u.primaryEmail === claims.sub && !u.suspended);
    if (!known) return json(400, { error: "invalid_grant", error_description: "Invalid email or User ID" });
    const token = `g-${this.tokens.size + 1}`;
    this.tokens.set(token, { sub: claims.sub, scope: claims.scope });
    return json(200, { access_token: token, expires_in: 3600, token_type: "Bearer" });
  }

  client(): GoogleClient {
    return new GoogleClient(TEST_SA, this.fetch, { token: "https://oauth2.test/token", admin: "https://admin.test", gmail: "https://gmail.test" });
  }
}

export const TENANT = "0b1f3a00-2ec4-4b6b-9e7f-ff5b2e000001";

const msKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const msJwk = { ...(msKeys.publicKey.export({ format: "jwk" }) as JWK), kid: "fake-ms", alg: "RS256", use: "sig" };
export const MS_CLIENT = { clientId: "ms-client", clientSecret: "ms-secret" };
const MS_ENDPOINTS = { login: "https://login.test", graph: "https://graph.test" };

interface PendingCode {
  tenant: string;
  nonce: string;
  challenge: string;
  redirectUri: string;
  clientId: string;
}

export class FakeMicrosoft {
  users: Record<string, unknown>[] = [];
  /** Codes from consent sign-ins, waiting to be redeemed. */
  codes = new Map<string, PendingCode>();
  /** Signs id_tokens; tests swap it to forge one. */
  signingKey = msKeys.privateKey;
  keys: JWTVerifyGetKey = createLocalJWKSet({ keys: [msJwk] });
  /** The tenant the next consent sign-in belongs to. */
  signInTenant = TENANT;
  groups: { id: string; displayName: string; members: string[] }[] = [];
  consented = new Set<string>([TENANT]);
  permissions = new Set(["User.Read.All", "GroupMember.Read.All"]);
  pageSize = 2;

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "login.test") {
      if (url.pathname === "/organizations/oauth2/v2.0/authorize") return this.authorize(url);
      if (url.pathname === "/organizations/oauth2/v2.0/token") return this.redeem(String(init?.body));
      if (url.pathname === "/common/discovery/v2.0/keys") return json(200, { keys: [msJwk] });
      const tenant = url.pathname.split("/")[1];
      if (!this.consented.has(tenant)) {
        return json(400, { error: "invalid_client", error_description: "AADSTS7000229: The client application is missing service principal in the tenant." });
      }
      return json(200, { access_token: `ms-${tenant}`, expires_in: 3600 });
    }
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    if (!auth.startsWith("Bearer ms-")) return json(401, { error: { code: "InvalidAuthenticationToken", message: "Access token is empty." } });
    const path = url.pathname.replace(/^\/v1\.0/, "");
    const skip = Number(url.searchParams.get("$skiptoken") ?? 0);
    const top = Math.min(Number(url.searchParams.get("$top") ?? 100), this.pageSize);
    const page = (list: unknown[]) => {
      const next = new URL(url);
      next.searchParams.set("$skiptoken", String(skip + top));
      return json(200, { value: list.slice(skip, skip + top), ...(skip + top < list.length ? { "@odata.nextLink": next.toString() } : {}) });
    };
    const denied = () => json(403, { error: { code: "Authorization_RequestDenied", message: "Insufficient privileges to complete the operation." } });
    if (path === "/users") return this.permissions.has("User.Read.All") ? page(this.users) : denied();
    if (path === "/groups") return this.permissions.has("GroupMember.Read.All") ? page(this.groups.map((g) => ({ id: g.id, displayName: g.displayName }))) : denied();
    const m = /^\/groups\/([^/]+)\/transitiveMembers\/microsoft\.graph\.user$/.exec(path);
    if (m) return page((this.groups.find((g) => g.id === m[1])?.members ?? []).map((id) => ({ id })));
    return json(404, { error: { code: "Request_ResourceNotFound", message: "Not found" } });
  };

  /** The admin signs in to `signInTenant` and accepts; Microsoft sends them back with a code. */
  authorize(url: URL): Response {
    const q = url.searchParams;
    const code = randomBytes(16).toString("hex");
    this.codes.set(code, { tenant: this.signInTenant, nonce: q.get("nonce") ?? "", challenge: q.get("code_challenge") ?? "", redirectUri: q.get("redirect_uri") ?? "", clientId: q.get("client_id") ?? "" });
    this.consented.add(this.signInTenant);
    const back = new URL(q.get("redirect_uri") ?? "");
    back.searchParams.set("code", code);
    back.searchParams.set("state", q.get("state") ?? "");
    return new Response(null, { status: 302, headers: { location: back.toString() } });
  }

  /** Signs an id_token as Microsoft would, for `tenant`. */
  idToken(claims: { tenant: string; nonce: string; aud?: string; iss?: string }): Promise<string> {
    return new SignJWT({ tid: claims.tenant, nonce: claims.nonce, name: "Thato Ramotswe", preferred_username: "thato@kalahari.example" })
      .setProtectedHeader({ alg: "RS256", kid: "fake-ms" })
      .setIssuer(claims.iss ?? `https://login.microsoftonline.com/${claims.tenant}/v2.0`)
      .setAudience(claims.aud ?? MS_CLIENT.clientId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(this.signingKey);
  }

  private async redeem(body: string): Promise<Response> {
    const q = new URLSearchParams(body);
    const pending = this.codes.get(q.get("code") ?? "");
    if (q.get("grant_type") !== "authorization_code" || !pending) return json(400, { error: "invalid_grant", error_description: "AADSTS70008: The provided authorization code is invalid." });
    this.codes.delete(q.get("code")!);
    const challenge = createHash("sha256").update(q.get("code_verifier") ?? "").digest("base64url");
    if (challenge !== pending.challenge || q.get("redirect_uri") !== pending.redirectUri || q.get("client_id") !== pending.clientId || q.get("client_secret") !== MS_CLIENT.clientSecret) {
      return json(400, { error: "invalid_grant", error_description: "AADSTS501481: The code verifier does not match." });
    }
    return json(200, { id_token: await this.idToken({ tenant: pending.tenant, nonce: pending.nonce }), access_token: "unused", token_type: "Bearer" });
  }

  /** Stands in for Providers.redeemConsent. */
  redeemConsent = (code: string, redirectUri: string, flow: Pick<ConsentFlow, "nonce" | "verifier">) => redeemConsent(MS_CLIENT, code, redirectUri, flow, this.fetch, MS_ENDPOINTS, this.keys);

  client(tenantId = TENANT): MicrosoftClient {
    return new MicrosoftClient(MS_CLIENT, tenantId, this.fetch, MS_ENDPOINTS);
  }
}

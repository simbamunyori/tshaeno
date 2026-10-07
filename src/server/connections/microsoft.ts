import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { kindForStatus, ProviderError, request, type Fetch } from "./http";
import type { DirectoryUser, HealthItem } from "./types";

/**
 * Microsoft 365 through our multi-tenant Entra app. The customer's admin
 * grants consent once; we then read their directory with the app's own
 * permissions (User.Read.All and GroupMember.Read.All). Signatures reach
 * Outlook through the add-in, not through Graph.
 */

export interface MicrosoftApp {
  clientId: string;
  clientSecret: string;
}

export interface MicrosoftEndpoints {
  login: string;
  graph: string;
}

export const MICROSOFT_ENDPOINTS: MicrosoftEndpoints = {
  login: "https://login.microsoftonline.com",
  graph: "https://graph.microsoft.com",
};

export const MICROSOFT_PERMISSIONS = ["User.Read.All", "GroupMember.Read.All"] as const;

export interface ConsentFlow {
  state: string;
  nonce: string;
  verifier: string;
}

export function newConsentFlow(): ConsentFlow {
  const r = () => randomBytes(32).toString("base64url");
  return { state: r(), nonce: r(), verifier: r() };
}

/**
 * The link an admin opens to grant the app access to their organisation.
 * It is a sign-in as well as a consent screen, so when they come back we
 * learn their tenant from a signed id_token, not from the address bar.
 */
export function adminConsentUrl(app: Pick<MicrosoftApp, "clientId">, redirectUri: string, flow: ConsentFlow, endpoints = MICROSOFT_ENDPOINTS): string {
  const q = new URLSearchParams({
    client_id: app.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "openid profile https://graph.microsoft.com/.default",
    prompt: "admin_consent",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return `${endpoints.login}/organizations/oauth2/v2.0/authorize?${q}`;
}

/** Personal Microsoft accounts all share this tenant; they have no directory. */
const PERSONAL_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";
const ISSUER = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/;

const jwksCache = new Map<string, JWTVerifyGetKey>();

/**
 * Swaps the code from the consent sign-in for an id_token, checks it, and
 * returns the tenant it proves the admin belongs to.
 */
export async function redeemConsent(
  app: MicrosoftApp,
  code: string,
  redirectUri: string,
  flow: Pick<ConsentFlow, "nonce" | "verifier">,
  f: Fetch = fetch,
  endpoints = MICROSOFT_ENDPOINTS,
  keys?: JWTVerifyGetKey,
): Promise<{ tenantId: string; adminName: string }> {
  const res = await request(f, `${endpoints.login}/organizations/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code_verifier: flow.verifier,
    }),
  });
  const idToken = (res.body as { id_token?: string } | null)?.id_token;
  if (res.status !== 200 || !idToken) throw new ProviderError("access", "Microsoft didn't confirm the sign-in. Try the consent link again.", res.status, res.text);
  let getKey = keys ?? jwksCache.get(endpoints.login);
  if (!getKey) {
    getKey = createRemoteJWKSet(new URL(`${endpoints.login}/common/discovery/v2.0/keys`));
    jwksCache.set(endpoints.login, getKey);
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, getKey, { audience: app.clientId, clockTolerance: 60 }));
  } catch (e) {
    throw new ProviderError("access", "Microsoft's sign-in couldn't be verified. Try the consent link again.", 0, String(e));
  }
  const tid = String(payload.tid ?? "");
  if (ISSUER.exec(String(payload.iss ?? ""))?.[1] !== tid || payload.nonce !== flow.nonce || !isTenantId(tid)) {
    throw new ProviderError("access", "Microsoft's sign-in couldn't be verified. Try the consent link again.");
  }
  if (tid === PERSONAL_TENANT) throw new ProviderError("invalid", "That is a personal Microsoft account. Sign in with a work account that is a global admin.");
  return { tenantId: tid, adminName: String(payload.name ?? payload.preferred_username ?? "Microsoft 365 admin") };
}

const TENANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isTenantId = (v: string) => TENANT.test(v);

const USER_FIELDS = [
  "id",
  "mail",
  "userPrincipalName",
  "givenName",
  "surname",
  "displayName",
  "jobTitle",
  "department",
  "officeLocation",
  "city",
  "businessPhones",
  "mobilePhone",
  "accountEnabled",
  "userType",
  "onPremisesExtensionAttributes",
].join(",");

export class MicrosoftClient {
  private cached: { token: string; expires: number } | null = null;

  constructor(
    private readonly app: MicrosoftApp,
    private readonly tenantId: string,
    private readonly f: Fetch = fetch,
    private readonly endpoints: MicrosoftEndpoints = MICROSOFT_ENDPOINTS,
  ) {
    if (!isTenantId(tenantId)) throw new ProviderError("invalid", "That isn't a Microsoft tenant id.");
  }

  async token(): Promise<string> {
    if (this.cached && this.cached.expires > Date.now()) return this.cached.token;
    const res = await request(this.f, `${this.endpoints.login}/${this.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.app.clientId,
        client_secret: this.app.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    const body = (res.body ?? {}) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (res.status === 200 && body.access_token) {
      this.cached = { token: body.access_token, expires: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 120) * 1000 };
      return body.access_token;
    }
    const d = body.error_description ?? "";
    if (/AADSTS(65001|700016|7000229|650052|500011)/.test(d) || body.error === "unauthorized_client") {
      throw new ProviderError("access", "Your Microsoft 365 admin hasn't granted consent yet. Open the consent link and accept.", res.status, res.text);
    }
    if (/AADSTS(90002|90072|50020)/.test(d)) {
      throw new ProviderError("not-found", "Microsoft can't find that organisation. Run the consent step again.", res.status, res.text);
    }
    if (/AADSTS(7000215|7000222)/.test(d)) {
      throw new ProviderError("not-configured", "Our Microsoft app's secret is wrong or has expired. This is on our side, not yours.", res.status, res.text);
    }
    throw new ProviderError(res.status >= 500 ? "unavailable" : "access", `Microsoft wouldn't issue access: ${d.split("\r\n")[0] || body.error || res.status}.`, res.status, res.text);
  }

  private async get(pathOrUrl: string): Promise<unknown> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.endpoints.graph}/v1.0${pathOrUrl}`;
    const res = await request(this.f, url, { headers: { authorization: `Bearer ${await this.token()}`, ConsistencyLevel: "eventual" } });
    if (res.status >= 200 && res.status < 300) return res.body;
    const message = (res.body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 403) {
      throw new ProviderError("access", "Consent was granted before Tshaeno needed this permission. Open the consent link again and accept.", res.status, res.text);
    }
    if (res.status === 429) throw new ProviderError("rate-limited", "Microsoft asked us to slow down. It will be tried again.", res.status, res.text);
    if (res.status >= 500) throw new ProviderError("unavailable", "Microsoft had a problem on its side. It will be tried again.", res.status, res.text);
    throw new ProviderError(kindForStatus(res.status), `Microsoft said: ${message}`, res.status, res.text);
  }

  private async all<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let next: string | undefined = path;
    while (next) {
      const page = (await this.get(next)) as { value?: T[]; "@odata.nextLink"?: string };
      out.push(...(page.value ?? []));
      next = page["@odata.nextLink"];
    }
    return out;
  }

  async listUsers(): Promise<DirectoryUser[]> {
    const users = await this.all<GraphUser>(`/users?$select=${USER_FIELDS}&$top=999`);
    const groups = await this.all<{ id: string; displayName?: string; mail?: string }>("/groups?$select=id,displayName,mail&$top=999");
    const byUser = new Map<string, string[]>();
    for (const g of groups) {
      const name = g.displayName || g.mail || g.id;
      const members = await this.all<{ id: string }>(`/groups/${g.id}/transitiveMembers/microsoft.graph.user?$select=id&$top=999`);
      for (const m of members) {
        const list = byUser.get(m.id) ?? [];
        if (!list.includes(name)) list.push(name);
        byUser.set(m.id, list);
      }
    }
    return users.filter((u) => u.userType !== "Guest" && (u.mail || u.userPrincipalName)).map((u) => toDirectoryUser(u, byUser.get(u.id) ?? []));
  }

  async health(): Promise<HealthItem[]> {
    const items: HealthItem[] = [];
    try {
      await this.token();
      items.push({ key: "consent", label: "Consent", ok: true, message: "Your admin has granted consent." });
    } catch (e) {
      items.push({ key: "consent", label: "Consent", ok: false, message: e instanceof ProviderError ? e.message : "Something unexpected went wrong. Try again." });
      return items;
    }
    const check = async (key: string, label: string, okMessage: string, path: string) => {
      try {
        await this.get(path);
        items.push({ key, label, ok: true, message: okMessage });
      } catch (e) {
        items.push({ key, label, ok: false, message: e instanceof ProviderError ? e.message : "Something unexpected went wrong. Try again." });
      }
    };
    await check("users", "Read people", "Tshaeno can read your users.", "/users?$top=1&$select=id");
    await check("groups", "Read groups", "Tshaeno can read your groups.", "/groups?$top=1&$select=id");
    return items;
  }
}

interface GraphUser {
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  givenName?: string | null;
  surname?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
  city?: string | null;
  businessPhones?: string[];
  mobilePhone?: string | null;
  accountEnabled?: boolean | null;
  userType?: string | null;
  onPremisesExtensionAttributes?: Record<string, string | null> | null;
}

export function toDirectoryUser(u: GraphUser, groups: string[]): DirectoryUser {
  let firstName = u.givenName ?? "";
  let lastName = u.surname ?? "";
  if (!firstName && u.displayName) {
    const parts = u.displayName.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName ||= parts.slice(1).join(" ");
  }
  const attributes: Record<string, string> = {};
  for (const [k, v] of Object.entries(u.onPremisesExtensionAttributes ?? {})) if (v) attributes[k] = v;
  return {
    externalId: u.id,
    email: (u.mail || u.userPrincipalName || "").toLowerCase(),
    firstName,
    lastName,
    title: u.jobTitle ?? "",
    department: u.department ?? "",
    phone: u.businessPhones?.[0] ?? "",
    mobile: u.mobilePhone ?? "",
    location: u.officeLocation || u.city || "",
    groups,
    active: u.accountEnabled !== false,
    attributes,
  };
}

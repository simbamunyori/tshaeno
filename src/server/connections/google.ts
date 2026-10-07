import { createSign } from "node:crypto";
import { kindForStatus, ProviderError, request, type Fetch } from "./http";
import type { DirectoryUser, HealthItem } from "./types";

/**
 * Google Workspace through our service account and domain-wide
 * delegation. The customer's admin trusts our client id for the scopes
 * below in their Admin console; we then act as their admin to read the
 * directory, and as each person to set their Gmail signature.
 */

export const GOOGLE_SCOPES = {
  users: "https://www.googleapis.com/auth/admin.directory.user.readonly",
  groups: "https://www.googleapis.com/auth/admin.directory.group.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.settings.basic",
} as const;

export interface ServiceAccount {
  clientEmail: string;
  clientId: string;
  privateKey: string;
}

export interface GoogleEndpoints {
  token: string;
  admin: string;
  gmail: string;
}

export const GOOGLE_ENDPOINTS: GoogleEndpoints = {
  token: "https://oauth2.googleapis.com/token",
  admin: "https://admin.googleapis.com",
  gmail: "https://gmail.googleapis.com",
};

/** Reads the service account key file's JSON, given as is or base64 encoded. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  try {
    const j = JSON.parse(text) as { client_email?: string; client_id?: string; private_key?: string };
    if (!j.client_email || !j.client_id || !j.private_key) return null;
    return { clientEmail: j.client_email, clientId: j.client_id, privateKey: j.private_key };
  } catch {
    return null;
  }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function signAssertion(sa: ServiceAccount, subject: string, scope: string, audience: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.clientEmail, sub: subject, scope, aud: audience, iat, exp: iat + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${signer.sign(sa.privateKey).toString("base64url")}`;
}

interface GoogleErrorBody {
  error?: string | { code?: number; message?: string; status?: string };
  error_description?: string;
}

export class GoogleClient {
  private tokens = new Map<string, { token: string; expires: number }>();

  constructor(
    private readonly sa: ServiceAccount,
    private readonly f: Fetch = fetch,
    private readonly endpoints: GoogleEndpoints = GOOGLE_ENDPOINTS,
  ) {}

  get clientId(): string {
    return this.sa.clientId;
  }

  /** An access token acting as `subject`, for one scope. */
  async token(subject: string, scope: string): Promise<string> {
    const key = `${subject}\n${scope}`;
    const hit = this.tokens.get(key);
    if (hit && hit.expires > Date.now()) return hit.token;
    const res = await request(this.f, this.endpoints.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signAssertion(this.sa, subject, scope, this.endpoints.token),
      }),
    });
    const body = (res.body ?? {}) as GoogleErrorBody & { access_token?: string; expires_in?: number };
    if (res.status === 200 && body.access_token) {
      this.tokens.set(key, { token: body.access_token, expires: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 120) * 1000 });
      if (this.tokens.size > 5000) this.tokens.delete(this.tokens.keys().next().value!);
      return body.access_token;
    }
    const code = typeof body.error === "string" ? body.error : "";
    const description = body.error_description ?? "";
    if (code === "unauthorized_client" || code === "access_denied") {
      throw new ProviderError(
        "access",
        `Domain-wide delegation doesn't allow this yet. In the Google Admin console, give client ID ${this.sa.clientId} the scopes shown on this page.`,
        res.status,
        res.text,
      );
    }
    if (code === "invalid_grant" && /email|user/i.test(description)) {
      throw new ProviderError("not-found", `Google doesn't recognise ${subject}. Check the address, and that the account isn't suspended.`, res.status, res.text);
    }
    throw new ProviderError(res.status >= 500 ? "unavailable" : "access", `Google wouldn't issue access: ${description || code || res.status}.`, res.status, res.text);
  }

  private async call(subject: string, scope: string, url: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.token(subject, scope);
    const res = await request(this.f, url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
    if (res.status >= 200 && res.status < 300) return res.body;
    const err = (res.body as GoogleErrorBody | null)?.error;
    const message = typeof err === "object" && err?.message ? err.message : res.text || `HTTP ${res.status}`;
    if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(res.text)) {
      throw new ProviderError("not-configured", "An API Tshaeno needs is turned off in our Google Cloud project. This is on our side, not yours.", res.status, res.text);
    }
    if (res.status === 403 && /not authorized|insufficient/i.test(message)) {
      throw new ProviderError("access", `${subject} can't do this. Use a Google Workspace super admin.`, res.status, res.text);
    }
    if (res.status === 429 || (res.status === 403 && /rate|quota/i.test(message))) {
      throw new ProviderError("rate-limited", "Google asked us to slow down. It will be tried again.", res.status, res.text);
    }
    if (res.status >= 500) throw new ProviderError("unavailable", "Google had a problem on its side. It will be tried again.", res.status, res.text);
    throw new ProviderError(kindForStatus(res.status), `Google said: ${message}`, res.status, res.text);
  }

  // ─── Directory ────────────────────────────────────────────────────

  async listUsers(admin: string): Promise<DirectoryUser[]> {
    const raw: GoogleUser[] = [];
    let pageToken = "";
    do {
      const q = new URLSearchParams({ customer: "my_customer", maxResults: "500", projection: "full", orderBy: "email" });
      if (pageToken) q.set("pageToken", pageToken);
      const page = (await this.call(admin, GOOGLE_SCOPES.users, `${this.endpoints.admin}/admin/directory/v1/users?${q}`)) as { users?: GoogleUser[]; nextPageToken?: string };
      raw.push(...(page.users ?? []));
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    const groups = await this.groupsByMember(admin);
    return raw.filter((u) => u.primaryEmail).map((u) => toDirectoryUser(u, groups.get(u.primaryEmail!.toLowerCase()) ?? []));
  }

  /** Each person's group names, by lowercased email. */
  async groupsByMember(admin: string): Promise<Map<string, string[]>> {
    const byEmail = new Map<string, string[]>();
    let pageToken = "";
    const groups: { email: string; name: string }[] = [];
    do {
      const q = new URLSearchParams({ customer: "my_customer", maxResults: "200" });
      if (pageToken) q.set("pageToken", pageToken);
      const page = (await this.call(admin, GOOGLE_SCOPES.groups, `${this.endpoints.admin}/admin/directory/v1/groups?${q}`)) as {
        groups?: { email: string; name?: string }[];
        nextPageToken?: string;
      };
      for (const g of page.groups ?? []) groups.push({ email: g.email, name: g.name || g.email });
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);
    for (const g of groups) {
      let token = "";
      do {
        const q = new URLSearchParams({ maxResults: "200", includeDerivedMembership: "true" });
        if (token) q.set("pageToken", token);
        const page = (await this.call(admin, GOOGLE_SCOPES.groups, `${this.endpoints.admin}/admin/directory/v1/groups/${encodeURIComponent(g.email)}/members?${q}`)) as {
          members?: { email?: string; type?: string }[];
          nextPageToken?: string;
        };
        for (const m of page.members ?? []) {
          if (m.type !== "USER" || !m.email) continue;
          const key = m.email.toLowerCase();
          const list = byEmail.get(key) ?? [];
          if (!list.includes(g.name)) list.push(g.name);
          byEmail.set(key, list);
        }
        token = page.nextPageToken ?? "";
      } while (token);
    }
    return byEmail;
  }

  // ─── Gmail ────────────────────────────────────────────────────────

  /** Sets the signature on a person's primary address. */
  async setSignature(email: string, html: string): Promise<void> {
    await this.call(email, GOOGLE_SCOPES.gmail, `${this.endpoints.gmail}/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature: html }),
    });
  }

  // ─── Health ───────────────────────────────────────────────────────

  async health(admin: string): Promise<HealthItem[]> {
    const items: HealthItem[] = [];
    const check = async (key: string, label: string, okMessage: string, run: () => Promise<unknown>) => {
      try {
        await run();
        items.push({ key, label, ok: true, message: okMessage });
      } catch (e) {
        items.push({ key, label, ok: false, message: e instanceof ProviderError ? e.message : "Something unexpected went wrong. Try again." });
      }
    };
    await check("users", "Read people", "Tshaeno can read your users.", () =>
      this.call(admin, GOOGLE_SCOPES.users, `${this.endpoints.admin}/admin/directory/v1/users?customer=my_customer&maxResults=1`),
    );
    await check("groups", "Read groups", "Tshaeno can read your groups.", () =>
      this.call(admin, GOOGLE_SCOPES.groups, `${this.endpoints.admin}/admin/directory/v1/groups?customer=my_customer&maxResults=1`),
    );
    await check("gmail", "Set Gmail signatures", "Tshaeno can set Gmail signatures.", () =>
      this.call(admin, GOOGLE_SCOPES.gmail, `${this.endpoints.gmail}/gmail/v1/users/me/settings/sendAs`),
    );
    return items;
  }
}

interface GoogleUser {
  id: string;
  primaryEmail?: string;
  name?: { givenName?: string; familyName?: string; fullName?: string };
  suspended?: boolean;
  archived?: boolean;
  organizations?: { title?: string; department?: string; location?: string; primary?: boolean }[];
  phones?: { value?: string; type?: string; primary?: boolean }[];
  locations?: { buildingId?: string; area?: string; type?: string }[];
  addresses?: { locality?: string; type?: string; primary?: boolean }[];
  customSchemas?: Record<string, Record<string, unknown>>;
}

export function toDirectoryUser(u: GoogleUser, groups: string[]): DirectoryUser {
  const org = u.organizations?.find((o) => o.primary) ?? u.organizations?.[0];
  const phone = (types: string[]) => u.phones?.find((p) => p.value && types.includes(p.type ?? ""))?.value ?? "";
  const attributes: Record<string, string> = {};
  for (const [schema, fields] of Object.entries(u.customSchemas ?? {})) {
    for (const [field, value] of Object.entries(fields ?? {})) {
      const v = Array.isArray(value) ? (value[0] as { value?: unknown })?.value : value;
      if (v !== undefined && v !== null && typeof v !== "object") attributes[`${schema}.${field}`] = String(v);
    }
  }
  const workAddress = u.addresses?.find((a) => a.type === "work") ?? u.addresses?.find((a) => a.primary);
  return {
    externalId: u.id,
    email: u.primaryEmail!.toLowerCase(),
    firstName: u.name?.givenName ?? "",
    lastName: u.name?.familyName ?? "",
    title: org?.title ?? "",
    department: org?.department ?? "",
    phone: phone(["work"]),
    mobile: phone(["mobile", "work_mobile"]),
    location: org?.location || u.locations?.[0]?.buildingId || workAddress?.locality || "",
    groups,
    active: !u.suspended && !u.archived,
    attributes,
  };
}

import { env } from "@/server/env";
import { GOOGLE_ENDPOINTS, GoogleClient, parseServiceAccount, type ServiceAccount } from "./google";
import { MICROSOFT_ENDPOINTS, MicrosoftClient, type MicrosoftApp } from "./microsoft";

/** Our side of each connection, from the environment. Null when this server isn't set up for it. */

export function serviceAccount(): ServiceAccount | null {
  return parseServiceAccount(env().GOOGLE_SERVICE_ACCOUNT_KEY);
}

export function microsoftApp(): MicrosoftApp | null {
  const e = env();
  const clientId = e.MICROSOFT_DIRECTORY_CLIENT_ID ?? e.MICROSOFT_CLIENT_ID;
  const clientSecret = e.MICROSOFT_DIRECTORY_CLIENT_SECRET ?? e.MICROSOFT_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function googleEndpoints() {
  const e = env();
  return {
    token: e.GOOGLE_TOKEN_URL ?? GOOGLE_ENDPOINTS.token,
    admin: e.GOOGLE_ADMIN_API ?? GOOGLE_ENDPOINTS.admin,
    gmail: e.GOOGLE_GMAIL_API ?? GOOGLE_ENDPOINTS.gmail,
  };
}

export function microsoftEndpoints() {
  const e = env();
  return { login: e.MICROSOFT_LOGIN_URL ?? MICROSOFT_ENDPOINTS.login, graph: e.MICROSOFT_GRAPH_API ?? MICROSOFT_ENDPOINTS.graph };
}

let google: GoogleClient | null | undefined;
/** One shared client, so access tokens are reused between jobs. */
export function googleClient(): GoogleClient | null {
  if (google === undefined) {
    const sa = serviceAccount();
    google = sa ? new GoogleClient(sa, fetch, googleEndpoints()) : null;
  }
  return google;
}

export function microsoftClient(tenantId: string): MicrosoftClient | null {
  const app = microsoftApp();
  return app ? new MicrosoftClient(app, tenantId, fetch, microsoftEndpoints()) : null;
}

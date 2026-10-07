import { env } from "@/server/env";
import { providerConfig } from "./oidc";

/** Which sign-in buttons to show: a provider appears once its credentials are set. */
export function enabledProviders(): { google: boolean; microsoft: boolean } {
  const e = env();
  return { google: providerConfig("google", e) !== null, microsoft: providerConfig("microsoft", e) !== null };
}

import { env } from "@/server/env";
import { providerConfig } from "./oidc";

export interface EnabledProviders {
  google: boolean;
  microsoft: boolean;
  fourthgen: boolean;
}

/** Which sign-in buttons to show: a provider appears once its credentials are set. */
export function enabledProviders(): EnabledProviders {
  const e = env();
  return {
    google: providerConfig("google", e) !== null,
    microsoft: providerConfig("microsoft", e) !== null,
    fourthgen: providerConfig("fourthgen", e) !== null,
  };
}

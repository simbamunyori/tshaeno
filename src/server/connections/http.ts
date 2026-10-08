/**
 * Talking to Google and Microsoft. Every failure becomes a ProviderError
 * with a plain explanation, and says whether trying again later could help.
 */

export type Fetch = typeof fetch;

export type ProviderErrorKind =
  /** Our own server isn't set up for this provider. */
  | "not-configured"
  /** The customer hasn't granted access, or granted too little. */
  | "access"
  /** The person or resource isn't there. */
  | "not-found"
  | "rate-limited"
  | "unavailable"
  | "invalid";

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly status = 0,
    /** What the provider actually said, for logs. */
    public readonly detail = "",
  ) {
    super(message);
    this.name = "ProviderError";
  }

  get retryable(): boolean {
    return this.kind === "rate-limited" || this.kind === "unavailable";
  }
}

export interface JsonResponse {
  status: number;
  body: unknown;
  text: string;
}

const TIMEOUT_MS = 20_000;

/** One request. Network failures and timeouts become "unavailable". */
export async function request(f: Fetch, url: string, init: RequestInit): Promise<JsonResponse> {
  let res: Response;
  try {
    res = await f(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ProviderError("unavailable", "Couldn't reach the service. It will be tried again.", 0, String(err));
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, text: text.slice(0, 2000) };
}

/** The error kind for an HTTP status nothing more specific explains. */
export function kindForStatus(status: number): ProviderErrorKind {
  if (status === 429) return "rate-limited";
  if (status >= 500) return "unavailable";
  if (status === 401 || status === 403) return "access";
  if (status === 404) return "not-found";
  return "invalid";
}

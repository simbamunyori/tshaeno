import { z } from "zod";

const optional = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === "" ? undefined : v), s.optional());

/**
 * Every secret comes from the environment. Nothing sensitive lives in the
 * repository; see .env.example for the full list.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Encrypts each person's authenticator secret. 32 random bytes, base64. */
  TOTP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "TOTP_ENCRYPTION_KEY must be 32 random bytes, base64 encoded"),
  SMTP_URL: optional(z.string().url()),
  MAIL_FROM: z.string().min(3).default("Tshaeno <no-reply@localhost>"),
  /** Sign in with Google: an OAuth client from Google Cloud console. */
  GOOGLE_CLIENT_ID: optional(z.string()),
  GOOGLE_CLIENT_SECRET: optional(z.string()),
  /** Sign in with Microsoft: a multi-tenant app registration in Entra ID. */
  MICROSOFT_CLIENT_ID: optional(z.string()),
  MICROSOFT_CLIENT_SECRET: optional(z.string()),
  /** Drafting signatures and reviewing them with Claude. Optional. */
  ANTHROPIC_API_KEY: optional(z.string()),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5-5"),
  /** Sign in from the Fourth Generation console: its OpenID Connect issuer and a client registered there. */
  FOURTHGEN_OIDC_ISSUER: optional(z.string().url()),
  FOURTHGEN_CLIENT_ID: optional(z.string()),
  FOURTHGEN_CLIENT_SECRET: optional(z.string()),
  /** Tshaeno's page in the Fourth Generation marketplace, linked from the website. */
  FOURTHGEN_MARKETPLACE_URL: optional(z.string().url()),
  /**
   * Connecting Google Workspace: our service account's JSON key, as is or
   * base64 encoded. Customers trust its client id with domain-wide delegation.
   */
  GOOGLE_SERVICE_ACCOUNT_KEY: optional(z.string()),
  /**
   * Connecting Microsoft 365: a multi-tenant Entra app with the application
   * permissions User.Read.All and GroupMember.Read.All. Falls back to the
   * sign-in app above when not set.
   */
  MICROSOFT_DIRECTORY_CLIENT_ID: optional(z.string()),
  MICROSOFT_DIRECTORY_CLIENT_SECRET: optional(z.string()),
  /**
   * DPO Pay, for paying invoices by card or mobile money. Until these are
   * set, invoices are paid by bank transfer only.
   */
  DPO_COMPANY_TOKEN: optional(z.string()),
  DPO_SERVICE_TYPE: optional(z.string()),
  /** Bank details printed on invoices, one item per line. */
  BANK_DETAILS: optional(z.string()),
  /** The public website, where the "Signature by Tshaeno" link goes. */
  WEBSITE_URL: z.string().url().default("https://tshaeno.com"),
  /** Who issues invoices: name, address and tax number, one item per line. */
  INVOICE_ISSUER: z.string().default("Tshaeno"),
  /** Tax added to invoices, as a percentage, and what it is called. 0 adds none. */
  TAX_PERCENT: z.coerce.number().min(0).max(50).default(0),
  TAX_LABEL: z.string().default("VAT"),
  /** Where Enterprise quote requests go. */
  SALES_EMAIL: optional(z.string().email()),
  /** Only for tests against stand-in servers. Leave unset. */
  DPO_API_URL: optional(z.string().url()),
  DPO_PAY_URL: optional(z.string().url()),
  GOOGLE_TOKEN_URL: optional(z.string().url()),
  GOOGLE_ADMIN_API: optional(z.string().url()),
  GOOGLE_GMAIL_API: optional(z.string().url()),
  MICROSOFT_LOGIN_URL: optional(z.string().url()),
  MICROSOFT_GRAPH_API: optional(z.string().url()),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Missing or invalid environment variables:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** The app's public origin and host, for passkeys and sign-in redirects. */
export function appOrigin(): { origin: string; rpId: string } {
  const url = new URL(env().APP_URL);
  return { origin: url.origin, rpId: url.hostname };
}

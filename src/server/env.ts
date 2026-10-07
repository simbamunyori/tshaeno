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
  /** Only for tests against stand-in servers. Leave unset. */
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

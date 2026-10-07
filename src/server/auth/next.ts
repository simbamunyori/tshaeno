import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { getSession, type AuthDeps, type RequestContext, type SessionWithUser } from "./service";

/**
 * Next.js glue for the auth service: the session cookie, request details
 * for the audit log, and guards for pages.
 */

export const SECURE = process.env.NODE_ENV === "production";
/** __Host- makes the browser insist on HTTPS, this exact host and path "/". */
export const SESSION_COOKIE = SECURE ? "__Host-tshaeno_session" : "tshaeno_session";

export function authDeps(): AuthDeps {
  return { db: prisma, encryptionKey: env().TOTP_ENCRYPTION_KEY };
}

export async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  // Caddy sets X-Forwarded-For; the first entry is the client.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ipAddress: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    // The server decides expiry; this only bounds how long the browser keeps it.
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentSession(): Promise<SessionWithUser | null> {
  // Read the cookie first: it marks the page as per-request, so Next.js
  // never tries to render it at build time, when no secrets exist.
  const token = await readSessionToken();
  if (!token) return null;
  return getSession(authDeps(), token);
}

/** Where a session in each stage belongs. */
export function homeFor(session: SessionWithUser | null): string {
  if (!session) return "/sign-in";
  if (session.stage === "CODE_PENDING") return "/sign-in/code";
  if (session.stage === "SETUP_PENDING") return "/setup-authenticator";
  return "/app";
}

/** For pages inside the app: signed in fully, or sent to the right step. */
export async function requireActiveSession(): Promise<SessionWithUser> {
  const session = await currentSession();
  if (!session || session.stage !== "ACTIVE") redirect(homeFor(session));
  return session;
}

/** A safe place to go after signing in: only a path on this site. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

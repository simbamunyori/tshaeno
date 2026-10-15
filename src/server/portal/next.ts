import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SECURE } from "@/server/auth/next";
import { SESSION_TTL_MS, portalSession, type PortalSession } from "./service";

/** The self-service page's own cookie, separate from Tshaeno accounts. */
export const PORTAL_COOKIE = SECURE ? "__Host-tshaeno_me" : "tshaeno_me";

export async function readPortalToken(): Promise<string | undefined> {
  return (await cookies()).get(PORTAL_COOKIE)?.value;
}

export async function setPortalCookie(token: string) {
  (await cookies()).set(PORTAL_COOKIE, token, { httpOnly: true, secure: SECURE, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS / 1000 });
}

export async function clearPortalCookie() {
  (await cookies()).delete(PORTAL_COOKIE);
}

export async function requirePortal(): Promise<PortalSession> {
  const s = await portalSession(await readPortalToken());
  if (!s) redirect("/me?expired=1");
  return s;
}

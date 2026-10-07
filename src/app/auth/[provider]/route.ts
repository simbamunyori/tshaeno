import { NextResponse, type NextRequest } from "next/server";
import { currentSession, safeNext, SECURE } from "@/server/auth/next";
import { authorizeUrl, newFlow, OIDC_COOKIE, providerConfig } from "@/server/auth/oidc";
import { appOrigin, env } from "@/server/env";


/**
 * Starts sign-in with Google or Microsoft, or linking one to the account
 * that is signed in (?intent=link). The flow's secrets wait in a
 * short-lived cookie for the callback.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const config = providerConfig(provider, env());
  if (!config) return NextResponse.redirect(new URL("/sign-in", appOrigin().origin));
  const intent = req.nextUrl.searchParams.get("intent") === "link" ? "link" : "sign-in";
  if (intent === "link" && (await currentSession())?.stage !== "ACTIVE") {
    return NextResponse.redirect(new URL("/sign-in?expired=1", appOrigin().origin));
  }
  const flow = newFlow(config.provider, intent, safeNext(req.nextUrl.searchParams.get("next")));
  const redirectUri = `${appOrigin().origin}/auth/${provider}/callback`;
  const res = NextResponse.redirect(authorizeUrl(config, flow, redirectUri));
  res.cookies.set(OIDC_COOKIE, Buffer.from(JSON.stringify(flow)).toString("base64url"), {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/auth",
    maxAge: 600,
  });
  return res;
}

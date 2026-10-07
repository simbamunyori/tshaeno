import { NextResponse, type NextRequest } from "next/server";
import { currentSession, safeNext, SECURE } from "@/server/auth/next";
import { authorizeUrl, discover, newFlow, OIDC_COOKIE, providerConfig } from "@/server/auth/oidc";
import { appOrigin, env } from "@/server/env";


/**
 * Starts sign-in with Google, Microsoft or the Fourth Generation console, or linking one to the account
 * that is signed in (?intent=link). The flow's secrets wait in a
 * short-lived cookie for the callback.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const configured = providerConfig(provider, env());
  if (!configured) return NextResponse.redirect(new URL("/sign-in", appOrigin().origin));
  let config;
  try {
    config = await discover(configured);
  } catch (err) {
    console.warn(`Sign-in with ${provider} is unavailable:`, err);
    return NextResponse.redirect(new URL("/sign-in?error=provider", appOrigin().origin));
  }
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

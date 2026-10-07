import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authDeps, currentSession, requestContext, setSessionCookie } from "@/server/auth/next";
import { finishFlow, OIDC_COOKIE, providerConfig, type FlowState } from "@/server/auth/oidc";
import { AuthError, linkIdentity, signInWithIdentity } from "@/server/auth/service";
import { kickMail } from "@/server/jobs/queue";
import { appOrigin, env } from "@/server/env";

function readFlow(req: NextRequest): FlowState | null {
  try {
    const raw = req.cookies.get(OIDC_COOKIE)?.value;
    return raw ? (JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as FlowState) : null;
  } catch {
    return null;
  }
}

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Google or Microsoft sends the person back here with a code. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = appOrigin().origin;
  const to = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    res.cookies.delete({ name: OIDC_COOKIE, path: "/auth" });
    return res;
  };
  const config = providerConfig(provider, env());
  const flow = readFlow(req);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  if (!config || !flow || flow.provider !== config.provider || !code || !sameState(state, flow.state)) {
    return to("/sign-in?error=provider");
  }

  let identity;
  try {
    identity = await finishFlow(config, flow, code, `${origin}/auth/${provider}/callback`);
  } catch (err) {
    console.warn(`Sign-in with ${provider} failed:`, err);
    return to(flow.intent === "link" ? "/app/settings/security?error=provider" : "/sign-in?error=provider");
  }

  const ctx = await requestContext();
  if (flow.intent === "link") {
    const session = await currentSession();
    if (session?.stage !== "ACTIVE") return to("/sign-in?expired=1");
    try {
      await linkIdentity(authDeps(), session, identity, ctx);
    } catch (e) {
      if (e instanceof AuthError) return to(`/app/settings/security?message=${encodeURIComponent(e.message)}`);
      throw e;
    }
    return to("/app/settings/security?linked=1");
  }

  try {
    const result = await signInWithIdentity(authDeps(), identity, ctx);
    await setSessionCookie(result.token);
    if (result.isNew) await kickMail();
    if (result.stage === "CODE_PENDING") return to(`/sign-in/code?next=${encodeURIComponent(flow.next ?? "/app")}`);
    return to(flow.next ?? "/app");
  } catch (e) {
    if (e instanceof AuthError) return to(`/sign-in?message=${encodeURIComponent(e.message)}`);
    throw e;
  }
}

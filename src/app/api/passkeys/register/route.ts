import { NextResponse, type NextRequest } from "next/server";
import { authDeps, currentSession, requestContext } from "@/server/auth/next";
import { beginPasskeyRegistration, finishPasskeyRegistration } from "@/server/auth/passkeys";
import { fromThisSite } from "@/server/auth/same-origin";
import { AuthError } from "@/server/auth/service";
import { appOrigin } from "@/server/env";

async function activeSession(req: NextRequest) {
  if (!fromThisSite(req)) return null;
  const session = await currentSession();
  return session?.stage === "ACTIVE" ? session : null;
}

/** Step 1: options for the browser to make a new passkey. */
export async function POST(req: NextRequest) {
  const session = await activeSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json(await beginPasskeyRegistration(authDeps(), appOrigin(), session));
}

/** Step 2: the new passkey, checked and saved. */
export async function PUT(req: NextRequest) {
  const session = await activeSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await finishPasskeyRegistration(authDeps(), appOrigin(), session, await req.json(), await requestContext());
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.warn("Passkey registration failed:", e);
    return NextResponse.json({ error: "Your device didn't confirm the passkey. Try again." }, { status: 400 });
  }
}

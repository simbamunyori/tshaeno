import { NextResponse, type NextRequest } from "next/server";
import { authDeps, requestContext, setSessionCookie } from "@/server/auth/next";
import { beginPasskeySignIn, finishPasskeySignIn } from "@/server/auth/passkeys";
import { fromThisSite } from "@/server/auth/same-origin";
import { AuthError } from "@/server/auth/service";
import { appOrigin } from "@/server/env";

/** Step 1: a challenge for the browser to sign. */
export async function POST(req: NextRequest) {
  if (!fromThisSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return NextResponse.json(await beginPasskeySignIn(authDeps(), appOrigin()));
}

/** Step 2: the signed challenge. A good one signs in fully. */
export async function PUT(req: NextRequest) {
  if (!fromThisSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    const body = await req.json();
    const { token } = await finishPasskeySignIn(authDeps(), appOrigin(), body, await requestContext());
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.warn("Passkey sign-in failed:", e);
    return NextResponse.json({ error: "That passkey didn't work." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { starter } from "@/lib/signature/starters";
import { origin } from "@/server/signatures/studio-data";
import { PICKED_TEMPLATE_COOKIE } from "@/server/site";

/**
 * "Use this template" on the website: remember the pick for a day, then
 * go to sign-up. Getting started shows it first once the account exists.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const target = new URL("/sign-up", origin());
  const res = NextResponse.redirect(target, 303);
  if (starter(key)) {
    res.cookies.set(PICKED_TEMPLATE_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: target.protocol === "https:", path: "/", maxAge: 86_400 });
  }
  return res;
}

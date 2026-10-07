import { NextResponse, type NextRequest } from "next/server";

/**
 * A fast first check for signed-in pages: no session cookie means straight
 * to sign-in. Each page still checks the session against the database.
 */
export function middleware(req: NextRequest) {
  const hasCookie = req.cookies.has("__Host-tshaeno_session") || req.cookies.has("tshaeno_session");
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin/:path*"] };

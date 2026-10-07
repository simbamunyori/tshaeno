import { recordClick } from "@/server/campaigns/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string; token?: string[] }> };

/** A campaign banner's link: counts the click, then goes where the banner points. */
async function handle(req: Request, { params }: Params) {
  const { key, token } = await params;
  const to = await recordClick({
    key,
    token: token?.[0] ?? "",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null,
    userAgent: req.headers.get("user-agent"),
    method: req.method,
  });
  if (!to) return new Response("This link has expired.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(null, { status: 302, headers: { location: to, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

export const GET = handle;
export const HEAD = handle;

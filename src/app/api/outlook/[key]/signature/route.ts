import { appOrigin } from "@/server/env";
import { signatureForOutlook } from "@/server/outlook/addin";

/**
 * Called by the Outlook add-in as someone writes an email. No cookies are
 * involved, so any origin may call it; the key in the path is what
 * identifies the organisation.
 */
const HEADERS = { "access-control-allow-origin": "*", "cache-control": "no-store", "content-type": "application/json" };

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const q = new URL(req.url).searchParams;
  const email = (q.get("email") ?? "").slice(0, 320);
  const compose = q.get("compose") === "reply" ? "reply" : "new";
  const domains = (q.get("domains") ?? "").split(",").slice(0, 100);
  const answer = await signatureForOutlook({ key, email, compose, domains }, appOrigin().origin);
  if (!answer) return new Response(JSON.stringify({ html: null, reason: "unknown-add-in" }), { status: 404, headers: HEADERS });
  return new Response(JSON.stringify(answer), { headers: HEADERS });
}

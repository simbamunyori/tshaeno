import { appOrigin } from "@/server/env";
import { isAddinKey, launchEventScript } from "@/server/outlook/addin";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isAddinKey(key)) return new Response("Not found", { status: 404 });
  return new Response(launchEventScript(appOrigin().origin, key), {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}

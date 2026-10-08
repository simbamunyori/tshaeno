import { commandsHtml, isAddinKey } from "@/server/outlook/addin";

export function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  return params.then(({ key }) =>
    isAddinKey(key)
      ? new Response(commandsHtml(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } })
      : new Response("Not found", { status: 404 }),
  );
}

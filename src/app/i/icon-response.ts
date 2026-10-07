/** A generated icon, cached for a year: the colour is in its address. */
export async function iconResponse(png: Promise<Buffer> | null): Promise<Response> {
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

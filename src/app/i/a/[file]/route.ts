import { readPublicAsset } from "@/server/signatures/assets";

/** Signature images, fetched by mail clients without signing in. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const asset = await readPublicAsset(file.replace(/\.(png|jpg|gif)$/, ""));
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "content-type": asset.contentType,
      // An asset never changes: a new upload gets a new id.
      "cache-control": "public, max-age=31536000, immutable",
      etag: `"${asset.sha256}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

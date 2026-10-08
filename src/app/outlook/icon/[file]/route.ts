import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SIZES = new Set([16, 32, 64, 80, 128]);
const cache = new Map<number, Promise<Buffer>>();

/** The add-in's icon at the sizes Outlook asks for, drawn from the app icon. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const size = Number(/^(\d+)\.png$/.exec(file)?.[1]);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  let png = cache.get(size);
  if (!png) {
    png = readFile(path.join(process.cwd(), "public", "app-icon.svg")).then((svg) => sharp(svg, { density: 300 }).resize(size, size).png().toBuffer());
    cache.set(size, png);
  }
  return new Response(new Uint8Array(await png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
}

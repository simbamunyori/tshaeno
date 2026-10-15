import type { MetadataRoute } from "next";
import { STARTERS } from "@/lib/signature/starters";
import { origin } from "@/server/signatures/studio-data";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const o = origin();
  const pages = ["", "/templates", "/pricing", "/compare", "/fourth-generation", "/sign-up"];
  return [...pages.map((p) => ({ url: `${o}${p}` })), ...STARTERS.map((s) => ({ url: `${o}/templates/${s.key}` }))];
}

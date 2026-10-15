import type { MetadataRoute } from "next";
import { origin } from "@/server/signatures/studio-data";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const o = origin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/me", "/c/", "/i/", "/templates/*/use", "/outlook", "/auth", "/connect"] },
    sitemap: `${o}/sitemap.xml`,
  };
}

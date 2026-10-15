import type { MetadataRoute } from "next";
import { STARTERS } from "@/lib/signature/starters";
import { GUIDES } from "@/lib/site/guides";
import { INDUSTRY_SOLUTIONS } from "@/lib/site/solutions";
import { TEAM_SOLUTIONS } from "@/lib/site/teams";
import { origin } from "@/server/signatures/studio-data";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const o = origin();
  const pages = [
    "",
    "/templates",
    "/pricing",
    "/compare",
    "/fourth-generation",
    "/demo",
    "/sign-up",
    "/solutions",
    "/guides",
    "/tools",
    "/tools/meeting-background",
    "/tools/out-of-office",
    "/tools/disclaimer",
    ...TEAM_SOLUTIONS.map((t) => `/solutions/${t.slug}`),
    ...INDUSTRY_SOLUTIONS.map((s) => `/solutions/${s.slug}`),
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    ...STARTERS.map((s) => `/templates/${s.key}`),
  ];
  return pages.map((p) => ({ url: `${o}${p}` }));
}

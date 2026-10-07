import type { NextRequest } from "next/server";
import { appOrigin } from "@/server/env";

/** JSON endpoints that change things only answer this site's own pages. */
export function fromThisSite(req: NextRequest): boolean {
  return req.headers.get("origin") === appOrigin().origin;
}

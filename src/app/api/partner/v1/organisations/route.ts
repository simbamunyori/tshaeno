import { partnerRoute } from "@/server/partner/http";
import { provision } from "@/server/partner/service";

export const dynamic = "force-dynamic";

/** Set up an organisation for the partner's customer. */
export async function POST(req: Request) {
  return partnerRoute(req, async (partner, body) => ({ status: 201, data: await provision(undefined, partner, body) }));
}

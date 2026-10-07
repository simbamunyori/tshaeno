import { partnerRoute } from "@/server/partner/http";
import { partnerPrices } from "@/server/partner/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return partnerRoute(req, async (partner) => ({ data: await partnerPrices(undefined, partner) }));
}

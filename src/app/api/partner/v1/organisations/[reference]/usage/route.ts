import { partnerRoute } from "@/server/partner/http";
import { organisationUsage } from "@/server/partner/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return partnerRoute(req, async (partner) => ({ data: await organisationUsage(undefined, partner, decodeURIComponent(reference)) }));
}

import { partnerRoute } from "@/server/partner/http";
import { cancel } from "@/server/partner/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return partnerRoute(req, async (partner, body) => ({ data: await cancel(undefined, partner, decodeURIComponent(reference), body) }));
}

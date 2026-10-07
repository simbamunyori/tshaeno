import { partnerRoute } from "@/server/partner/http";
import { suspend } from "@/server/partner/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return partnerRoute(req, async (partner, body) => ({ data: await suspend(undefined, partner, decodeURIComponent(reference), body) }));
}

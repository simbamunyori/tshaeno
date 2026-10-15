import { partnerRoute } from "@/server/partner/http";
import { resume } from "@/server/partner/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return partnerRoute(req, async (partner) => ({ data: await resume(undefined, partner, decodeURIComponent(reference)) }));
}

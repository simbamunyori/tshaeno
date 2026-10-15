import { partnerRoute } from "@/server/partner/http";
import { getOrganisation, updateOrganisation } from "@/server/partner/service";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ reference: string }> };

export async function GET(req: Request, { params }: Params) {
  const { reference } = await params;
  return partnerRoute(req, async (partner) => ({ data: await getOrganisation(undefined, partner, decodeURIComponent(reference)) }));
}

/** Change the plan, the seats or the name. */
export async function PATCH(req: Request, { params }: Params) {
  const { reference } = await params;
  return partnerRoute(req, async (partner, body) => ({ data: await updateOrganisation(undefined, partner, decodeURIComponent(reference), body) }));
}

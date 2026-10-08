import { requestContext } from "@/server/auth/next";
import { appOrigin } from "@/server/env";
import { assertCan } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { addinKey, manifestXml } from "@/server/outlook/addin";

/** The organisation's Outlook add-in manifest, made on first download. */
export async function GET() {
  const { organisation, actor } = await requireMember();
  assertCan(actor, "manageOrganisation");
  const key = await addinKey({ organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress });
  const xml = manifestXml({ origin: appOrigin().origin, key, organisationId: organisation.id, organisationName: organisation.name });
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": 'attachment; filename="tshaeno-outlook-manifest.xml"',
      "cache-control": "no-store",
    },
  });
}

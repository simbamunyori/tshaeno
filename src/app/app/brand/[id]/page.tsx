import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { kitData, toBrandData } from "@/server/signatures/brand";
import { origin } from "@/server/signatures/studio-data";
import { deleteKitAction, makeDefaultAction } from "../actions";
import { KitEditor } from "./kit-editor";

export const metadata: Metadata = { title: "Brand kit" };

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, organisation } = await requireMember();
  const kit = await asTenant(organisation.id, (tx) =>
    tx.brandKit.findFirst({ where: { id }, include: { logo: { select: { id: true, contentType: true, width: true, height: true } } } }),
  );
  if (!kit) notFound();
  const manage = can(actor, "manageTemplates");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={<Link href="/app/brand" className="hover:text-ink">Brand kits</Link>} title={kit.name} />
      <KitEditor id={kit.id} name={kit.name} data={kitData(kit, organisation.name)} logo={toBrandData(kit, origin()).logo} origin={origin()} readOnly={!manage} />
      {manage ? (
        <div className="flex flex-wrap gap-4 border-t border-border pt-6">
          {kit.isDefault ? (
            <p className="text-callout text-ink-muted">This is the default kit. Signatures without a kit of their own use it.</p>
          ) : (
            <>
              <form action={makeDefaultAction}>
                <input type="hidden" name="id" value={kit.id} />
                <button className="text-callout font-semibold text-link hover:underline">Make this the default</button>
              </form>
              <form action={deleteKitAction}>
                <input type="hidden" name="id" value={kit.id} />
                <button className="text-callout font-semibold text-negative hover:underline">Delete this kit</button>
              </form>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

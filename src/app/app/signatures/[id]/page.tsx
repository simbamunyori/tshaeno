import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Studio } from "@/components/signatures/studio/studio";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { origin, studioData } from "@/server/signatures/studio-data";
import { contentOf } from "@/server/signatures/templates";
import { archiveAction, duplicateAction } from "../actions";

export const metadata: Metadata = { title: "Signature studio" };

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, organisation } = await requireMember();
  const [template, customFields] = await asTenant(organisation.id, (tx) =>
    Promise.all([
      tx.signatureTemplate.findFirst({ where: { id }, include: { published: { select: { number: true, createdAt: true } } } }),
      tx.customField.findMany({ orderBy: { createdAt: "asc" }, select: { key: true, label: true } }),
    ]),
  );
  if (!template) notFound();
  const data = await studioData(organisation.id);
  const manage = can(actor, "manageTemplates");

  return (
    <div className="flex flex-col gap-8">
      <Studio
        template={{
          id: template.id,
          name: template.name,
          content: contentOf(template.kind, template.draft),
          brandKitId: template.brandKitId,
          publishedNumber: template.published?.number ?? null,
          unpublishedChanges: !template.published || template.updatedAt.getTime() > template.published.createdAt.getTime() + 1000,
          archived: !!template.archivedAt,
        }}
        kits={data.kits}
        people={data.people}
        assets={data.assets}
        customFields={customFields}
        origin={origin()}
        readOnly={!manage}
      />
      {manage ? (
        <div className="flex flex-wrap gap-4 border-t border-border pt-6">
          <form action={duplicateAction}>
            <input type="hidden" name="id" value={template.id} />
            <button className="text-callout font-semibold text-link hover:underline">Make a copy</button>
          </form>
          <form action={archiveAction}>
            <input type="hidden" name="id" value={template.id} />
            <input type="hidden" name="archived" value={template.archivedAt ? "0" : "1"} />
            <button className="text-callout font-semibold text-negative hover:underline">
              {template.archivedAt ? "Restore this signature" : "Archive this signature"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

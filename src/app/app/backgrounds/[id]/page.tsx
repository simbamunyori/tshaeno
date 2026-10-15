import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { backgrounds } from "@/server/backgrounds/service";
import { kitOptions, peopleOptions } from "@/server/backgrounds/kits";
import { orgAccess } from "@/server/billing/premium";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { deleteBackgroundAction } from "../actions";
import { BackgroundEditor } from "../background-editor";
import { PersonDownload } from "../person-download";

export const metadata: Metadata = { title: "Meeting background" };

export default async function BackgroundPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { actor, organisation } = await requireMember();
  if (!(await orgAccess(organisation.id)).premium) redirect("/app/backgrounds");
  const { list, kits, people } = await asTenant(organisation.id, async (tx) => ({
    list: await backgrounds(tx, organisation.id, ""),
    kits: await kitOptions(tx, organisation.id),
    people: await peopleOptions(tx),
  }));
  const b = list.find((x) => x.id === id);
  if (!b) notFound();
  const manage = can(actor, "manageTemplates");
  const sample = people[0] ?? { name: actor.name, title: "Your title" };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Meeting backgrounds" title={b.name} />
      {(await searchParams).created ? <Alert tone="positive">Created. {b.published ? "Everyone can download their copy from their own page." : ""}</Alert> : null}
      {manage ? (
        <Card>
          <CardHeader title="Design" />
          <BackgroundEditor initial={{ id: b.id, name: b.name, style: b.style, colour: b.colour, brandKitId: b.brandKitId, photoUrl: b.photoUrl, showName: b.showName, showTitle: b.showTitle, published: b.published }} kits={kits} sample={sample} />
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Download someone's copy">Useful for new starters, or anyone who can&apos;t use their own page.</CardHeader>
        <PersonDownload design={b} designName={b.name} people={people} />
      </Card>
      {manage ? (
        <Card>
          <CardHeader title="Delete this background">People who already downloaded it keep their copy.</CardHeader>
          <ActionForm action={deleteBackgroundAction} submit="Delete background" variant="destructive" pending="Deleting…">
            <input type="hidden" name="id" value={b.id} />
          </ActionForm>
        </Card>
      ) : null}
    </div>
  );
}

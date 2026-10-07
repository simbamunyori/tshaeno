import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { RenameForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { actor, organisation } = await requireMember();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="Settings" />
      <Card>
        <CardHeader title="Organisation">The name your team sees in Tshaeno and in invitation emails.</CardHeader>
        <RenameForm name={organisation.name} disabled={!can(actor, "manageOrganisation")} />
      </Card>
    </div>
  );
}

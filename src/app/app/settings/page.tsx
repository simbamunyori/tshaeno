import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { ActionForm } from "@/components/ui/action-form";
import { appOrigin } from "@/server/env";
import { CopyValue } from "../connections/forms";
import { portalAction } from "./actions";
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
      <Card>
        <CardHeader title="Self-service page">
          Let people update their own photo and social links, without a Tshaeno account. They sign in with a link sent to their work email. Everything else still comes from your directory.
        </CardHeader>
        {organisation.portalEnabled ? (
          <div className="mb-5">
            <CopyValue label="Share this address with your team" value={`${appOrigin().origin}/me`} />
          </div>
        ) : null}
        {can(actor, "manageOrganisation") ? (
          <ActionForm action={portalAction} submit="Save">
            <label className="flex items-start gap-3 text-body text-ink">
              <input type="checkbox" name="enabled" defaultChecked={organisation.portalEnabled} className="mt-1 size-4 accent-[var(--brand)]" />
              <span>Turn on the self-service page</span>
            </label>
            <label className="flex items-start gap-3 text-body text-ink">
              <input type="checkbox" name="photo" defaultChecked={organisation.portalPhoto} className="mt-1 size-4 accent-[var(--brand)]" />
              <span>
                People can change their own photo <span className="text-callout text-ink-muted">Turn off if you manage photos centrally.</span>
              </span>
            </label>
          </ActionForm>
        ) : null}
      </Card>
    </div>
  );
}

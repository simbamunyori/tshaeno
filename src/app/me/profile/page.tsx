import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { ActionFileField, ActionForm, ActionTextField } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SignatureThumb } from "@/components/signatures/thumb";
import { SOCIAL_EXAMPLE, SOCIAL_NAME } from "@/lib/signature/socials";
import { asTenant } from "@/server/db";
import { GMAIL_CONTEXT } from "@/server/delivery/gmail";
import { OrgRenderer } from "@/server/delivery/renderer";
import { requirePortal } from "@/server/portal/next";
import { personSocials } from "@/server/signatures/people";
import { origin } from "@/server/signatures/studio-data";
import { photoAction, signOutAction, socialsAction } from "../actions";

export const metadata: Metadata = { title: "Your signature", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalProfile() {
  const s = await requirePortal();
  const preview = await asTenant(s.organisation.id, (tx) => new OrgRenderer(tx, s.organisation.id, origin()).render(s.person, GMAIL_CONTEXT));
  const mine = personSocials(s.person);
  const name = `${s.person.firstName} ${s.person.lastName}`.trim();

  return (
    <div className="min-h-dvh bg-surface-2">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface-1 px-4 sm:px-8">
        <Logo size={26} />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 sm:px-8">
        <div>
          <p className="text-callout text-ink-muted">{s.organisation.name}</p>
          <h1 className="text-title-1 text-ink">Hello, {s.person.firstName}</h1>
        </div>

        <Card>
          <CardHeader title="Your signature">
            How it looks on new emails. Your name, title and phone come from {s.organisation.name}&apos;s directory, so ask your admin to change those.
          </CardHeader>
          {preview ? (
            <SignatureThumb html={preview.html} title={`${name}'s signature`} />
          ) : (
            <Alert tone="info">{s.organisation.name} hasn&apos;t given you a signature yet. Your changes are saved for when they do.</Alert>
          )}
        </Card>

        {s.organisation.portalPhoto ? (
          <Card>
            <CardHeader title="Your photo">Shown in signatures that include one. A square crop is made around the face.</CardHeader>
            <ActionForm action={photoAction} submit="Upload photo" pending="Uploading…">
              <ActionFileField id="file" label="Photo" hint="PNG, JPEG or GIF, up to 5 MB." accept="image/png,image/jpeg,image/gif" />
            </ActionForm>
            {s.person.photoAssetId ? (
              <ActionForm action={photoAction} submit="Remove my photo" variant="secondary" pending="Removing…" className="mt-4">
                <input type="hidden" name="remove" value="1" />
              </ActionForm>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Your social links">
            {s.networks.length
              ? "Used in place of the company's links for the same network. Leave one empty to show the company's."
              : `${s.organisation.name}'s signatures don't show social links yet.`}
          </CardHeader>
          {s.networks.length ? (
            <ActionForm action={socialsAction} submit="Save links">
              <div className="flex flex-col gap-4">
                {s.networks.map((n) => (
                  <ActionTextField key={n} id={`social_${n}`} label={SOCIAL_NAME[n]} type="url" inputMode="url" defaultValue={mine[n] ?? ""} placeholder={SOCIAL_EXAMPLE[n]} />
                ))}
              </div>
            </ActionForm>
          ) : null}
        </Card>
      </main>
    </div>
  );
}

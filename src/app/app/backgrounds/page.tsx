import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UpgradePanel } from "@/components/app/upgrade-panel";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { backgrounds } from "@/server/backgrounds/service";
import { kitOptions, peopleOptions } from "@/server/backgrounds/kits";
import { orgAccess } from "@/server/billing/premium";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { BackgroundCanvas } from "@/components/backgrounds/background-canvas";
import { BackgroundEditor } from "./background-editor";

export const metadata: Metadata = { title: "Meeting backgrounds" };

export default async function BackgroundsPage() {
  const { actor, organisation } = await requireMember();
  const plan = await orgAccess(organisation.id);
  const header = (
    <>
      <PageHeader eyebrow={organisation.name} title="Meeting backgrounds" />
      <p className="-mt-4 max-w-2xl text-body text-ink-muted">
        A branded background for Zoom, Microsoft Teams and Google Meet. Design it once and everyone gets their own copy, with their name and title, to download from their own page.
      </p>
    </>
  );
  if (!plan.premium) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <UpgradePanel feature="backgrounds" partner={plan.partner} canBill={can(actor, "manageBilling")} />
      </div>
    );
  }
  if (!can(actor, "view")) notFound();
  const { list, kits, people } = await asTenant(organisation.id, async (tx) => ({
    list: await backgrounds(tx, organisation.id, ""),
    kits: await kitOptions(tx, organisation.id),
    people: await peopleOptions(tx),
  }));
  const sample = people[0] ?? { name: actor.name, title: "Your title" };
  const manage = can(actor, "manageTemplates");

  return (
    <div className="flex flex-col gap-8">
      {header}
      {list.length ? (
        <ul className="grid gap-6 md:grid-cols-2">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/app/backgrounds/${b.id}`} className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface-1 p-4 hover:border-border-strong">
                <BackgroundCanvas design={b} name={sample.name} title={sample.title} />
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-link">{b.name}</span>
                  <span className="text-callout text-ink-muted">{b.published ? "Offered to everyone" : "Not offered yet"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {manage ? (
        <Card>
          <CardHeader title={list.length ? "Add another background" : "Design your first background"}>
            Pick a style and colour. Your logo comes from your brand kit, and each person&apos;s name and title from your directory.
          </CardHeader>
          <BackgroundEditor
            initial={{ id: null, name: list.length ? "Event background" : "Company background", style: "panel", colour: kits[0]?.colours[0]?.toUpperCase() ?? "#14213D", brandKitId: kits[0]?.id ?? null, photoUrl: null, showName: true, showTitle: true, published: true }}
            kits={kits}
            sample={sample}
          />
        </Card>
      ) : null}
      <p className="text-callout text-ink-muted">
        People download theirs from their own page once you turn on self-service under{" "}
        <Link href="/app/settings" className="font-semibold text-link hover:underline">
          Settings
        </Link>
        . You can also download anyone&apos;s copy from a background&apos;s page and send it to them.
      </p>
    </div>
  );
}

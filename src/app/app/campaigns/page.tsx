import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { campaignReports } from "@/server/campaigns/service";
import { targetOptions } from "@/server/campaigns/options";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { assetUrl } from "@/server/signatures/assets";
import { origin } from "@/server/signatures/studio-data";
import { saveCampaignAction } from "./actions";
import { CampaignFields } from "./campaign-fields";
import { StateChip } from "./state";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { actor, organisation } = await requireMember();
  const { reports, options } = await asTenant(organisation.id, async (tx) => ({ reports: await campaignReports(tx), options: await targetOptions(tx) }));
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: organisation.timeZone });
  const manage = can(actor, "manageTemplates");
  const o = origin();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="Campaigns" />
      <p className="-mt-4 max-w-2xl text-body text-ink-muted">
        A banner under everyone&apos;s signature, or one team&apos;s, for as long as you choose. Every email becomes a small advert, and you see how many people click.
      </p>

      {reports.length ? (
        <Card>
          <CardHeader title="Your campaigns" />
          <ul className="flex flex-col divide-y divide-border">
            {reports.map((r) => (
              <li key={r.campaign.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                {r.campaign.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(o, r.campaign.image)} alt="" className="h-12 w-48 shrink-0 rounded-sm border border-border object-cover" />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/campaigns/${r.campaign.id}`} className="font-semibold text-link hover:underline">
                      {r.campaign.name}
                    </Link>
                    <StateChip state={r.state} />
                  </div>
                  <span className="text-callout text-ink-muted">
                    {day.format(r.campaign.startsAt)}
                    {r.campaign.endsAt ? ` to ${day.format(r.campaign.endsAt)}` : ", no end date"}
                  </span>
                </div>
                <div className="text-callout text-ink sm:text-right">
                  <span className="text-headline tabular-nums">{r.clicks}</span> {r.clicks === 1 ? "click" : "clicks"}
                  <span className="block text-ink-muted">{r.clicks30} in the last 30 days</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {manage ? (
        <Card>
          <CardHeader title="New campaign">The banner goes in its own row under the signature, so signatures look the same with or without it.</CardHeader>
          <ActionForm action={saveCampaignAction} submit="Create campaign" pending="Creating…" encType="multipart/form-data">
            <CampaignFields campaign={null} timeZone={organisation.timeZone} options={options} />
          </ActionForm>
        </Card>
      ) : null}
    </div>
  );
}

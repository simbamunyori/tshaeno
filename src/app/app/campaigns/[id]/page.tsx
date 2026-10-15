import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { campaignReports } from "@/server/campaigns/service";
import { targetOptions } from "@/server/campaigns/options";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { assetUrl } from "@/server/signatures/assets";
import { origin } from "@/server/signatures/studio-data";
import { deleteCampaignAction, endCampaignAction, pauseCampaignAction, saveCampaignAction } from "../actions";
import { CampaignFields } from "../campaign-fields";
import { DailyBars, StateChip } from "../state";

export const metadata: Metadata = { title: "Campaign" };

const AUDIENCE = { EXTERNAL: "emails to people outside", INTERNAL: "emails inside the organisation", ANY: "all emails" };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const { actor, organisation } = await requireMember();
  const { report, options } = await asTenant(organisation.id, async (tx) => ({
    report: (await campaignReports(tx)).find((r) => r.campaign.id === id),
    options: await targetOptions(tx),
  }));
  if (!report) notFound();
  const c = report.campaign;
  const manage = can(actor, "manageTemplates");
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: organisation.timeZone });
  const who = c.scope === "EVERYONE" ? "Everyone" : c.scope === "DEPARTMENT" ? `The ${c.department} department` : c.scope === "LOCATION" ? `People in ${c.location}` : `The ${c.groupName} group`;
  const on = [c.forNew ? "new emails" : null, c.forReply ? "replies" : null].filter(Boolean).join(" and ");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Campaigns" title={c.name} />
      {created ? <Alert tone="positive">Created. Gmail signatures update in a minute or two; Outlook picks it up on the next email.</Alert> : null}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StateChip state={report.state} />
          <span className="text-callout text-ink-muted">
            {when.format(c.startsAt)}
            {c.endsAt ? ` to ${when.format(c.endsAt)}` : ", no end date"}
          </span>
        </div>
        {c.image ? (
          <a href={c.linkUrl} target="_blank" rel="noreferrer" className="block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl(origin(), c.image)} alt={c.alt} style={{ width: c.width }} className="max-w-full rounded-sm border border-border" />
          </a>
        ) : null}
        <p className="mt-4 text-callout text-ink">
          {who}, on {on || "no emails"}, in {AUDIENCE[c.audience]}. Opens <span className="break-all">{c.linkUrl}</span>.
        </p>
        {manage ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {report.state === "running" || report.state === "scheduled" || report.state === "paused" ? (
              <form action={pauseCampaignAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="paused" value={report.state === "paused" ? "0" : "1"} />
                <Button type="submit" variant="secondary">
                  {report.state === "paused" ? "Resume" : "Pause"}
                </Button>
              </form>
            ) : null}
            {report.state !== "ended" ? (
              <form action={endCampaignAction}>
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" variant="secondary">
                  End now
                </Button>
              </form>
            ) : null}
            <form action={deleteCampaignAction}>
              <input type="hidden" name="id" value={c.id} />
              <Button type="submit" variant="ghost" className="text-negative">
                Delete, with its clicks
              </Button>
            </form>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Clicks">Counted once a day for each person who clicks. Link checkers in mail servers aren&apos;t counted.</CardHeader>
        <dl className="mb-5 grid grid-cols-2 gap-4 text-callout">
          <div>
            <dt className="text-ink-muted">All time</dt>
            <dd className="text-title-2 text-ink tabular-nums">{report.clicks}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Last 30 days</dt>
            <dd className="text-title-2 text-ink tabular-nums">{report.clicks30}</dd>
          </div>
        </dl>
        <DailyBars daily={report.daily} label={`Clicks per day for the last 30 days: ${report.daily.join(", ")}`} />
        <p className="mt-1 flex justify-between text-caption text-ink-muted">
          <span>30 days ago</span>
          <span>Today</span>
        </p>
        {report.topSenders.length ? (
          <div className="mt-5">
            <h3 className="mb-2 text-callout font-semibold text-ink">Whose emails got the most clicks</h3>
            <ol className="flex flex-col gap-1 text-callout">
              {report.topSenders.map((s) => (
                <li key={s.name} className="flex justify-between gap-4">
                  <span className="text-ink">{s.name}</span>
                  <span className="tabular-nums text-ink-muted">{s.clicks}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Card>

      {manage ? (
        <Card>
          <CardHeader title="Change it" />
          <ActionForm action={saveCampaignAction} submit="Save" encType="multipart/form-data">
            <CampaignFields campaign={c} timeZone={organisation.timeZone} options={options} />
          </ActionForm>
        </Card>
      ) : null}
    </div>
  );
}

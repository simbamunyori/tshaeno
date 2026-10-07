import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { aiAvailable } from "@/server/ai/claude";
import { analytics } from "@/server/analytics/service";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { origin } from "@/server/signatures/studio-data";
import { DailyBars, StateChip } from "../campaigns/state";
import { ClaudeReview, FindingList } from "./findings";

export const metadata: Metadata = { title: "Reports" };

const GRADE = {
  good: { text: "Signatures are in good shape.", tone: "text-positive", ring: "border-positive" },
  fair: { text: "Mostly working, with a few gaps.", tone: "text-warning", ring: "border-warning" },
  poor: { text: "Signatures aren't reaching most people yet.", tone: "text-negative", ring: "border-negative" },
} as const;

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "0%");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ detail?: string }> }) {
  const { actor, organisation } = await requireMember();
  if (!can(actor, "viewAnalytics")) notFound();
  const a = await asTenant(organisation.id, (tx) => analytics(tx, organisation.id, origin()));
  const detailed = a.detailed || (await searchParams).detail === "1";
  const grade = GRADE[a.health.grade];
  const clicks30 = a.campaigns.reduce((n, c) => n + c.clicks30, 0);
  const daily = Array.from({ length: 30 }, (_, i) => a.campaigns.reduce((n, c) => n + c.daily[i], 0));
  const updates = a.delivery.filter((d) => d.applied + d.failed + d.waiting > 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="Reports" />

      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className={cn("flex size-28 shrink-0 flex-col items-center justify-center rounded-full border-8", grade.ring)}>
            <span className="text-title-1 text-ink tabular-nums">{a.health.score}</span>
            <span className="text-caption text-ink-muted">of 100</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className={cn("text-headline", grade.tone)}>{grade.text}</h2>
            {a.health.tips.length ? (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-callout text-ink">
                {a.health.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-callout text-ink-muted">Everyone has their signature, updates are working and everything is on brand.</p>
            )}
            <p className="text-caption text-ink-muted">The score weighs who has a signature most, then whether updates work, the directory connection and brand checks.</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/app/coverage" className="rounded-lg border border-border bg-surface-1 p-4 hover:bg-surface-2">
          <span className="block text-title-2 text-ink tabular-nums">{pct(a.coverage.covered, a.people)}</span>
          <span className="text-callout text-ink-muted">
            have their signature ({a.coverage.covered} of {a.people})
          </span>
        </Link>
        <div className="rounded-lg border border-border bg-surface-1 p-4">
          <span className="block text-title-2 text-ink tabular-nums">
            {updates.length ? pct(updates.reduce((n, d) => n + d.applied, 0), updates.reduce((n, d) => n + d.applied + d.failed, 0)) : "None yet"}
          </span>
          <span className="text-callout text-ink-muted">of signature updates worked, last 30 days</span>
        </div>
        <Link href="/app/campaigns" className="rounded-lg border border-border bg-surface-1 p-4 hover:bg-surface-2">
          <span className="block text-title-2 text-ink tabular-nums">{clicks30}</span>
          <span className="text-callout text-ink-muted">banner {clicks30 === 1 ? "click" : "clicks"}, last 30 days</span>
        </Link>
      </div>

      <Card>
        <CardHeader title="Brand check">
          {a.brand.length ? "Things that make signatures look different from each other, or from your brand." : "Every published signature uses your brand colours, logo and disclaimer."}
        </CardHeader>
        {a.brand.length ? (
          <div className="mb-5">
            <FindingList findings={a.brand} />
          </div>
        ) : null}
        {aiAvailable() ? <ClaudeReview /> : null}
      </Card>

      {detailed ? (
        <>
          {updates.length ? (
            <Card>
              <CardHeader title="Signature updates, last 30 days" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-callout">
                  <thead className="text-ink-muted">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Where</th>
                      <th className="py-2 pr-4 font-semibold">Worked</th>
                      <th className="py-2 pr-4 font-semibold">Failed</th>
                      <th className="py-2 font-semibold">Waiting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {updates.map((d) => (
                      <tr key={d.target}>
                        <td className="py-2 pr-4 text-ink">{d.target === "GMAIL" ? "Gmail" : "Outlook"}</td>
                        <td className="py-2 pr-4 text-ink">{d.applied}</td>
                        <td className={cn("py-2 pr-4", d.failed ? "text-negative" : "text-ink")}>{d.failed}</td>
                        <td className="py-2 text-ink">{d.waiting}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="By department">Who has their signature, team by team.</CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-callout">
                <thead className="text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Department</th>
                    <th className="py-2 pr-4 font-semibold">People</th>
                    <th className="py-2 pr-4 font-semibold">Have it</th>
                    <th className="w-1/3 py-2 font-semibold">
                      <span className="sr-only">Share</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {a.departments.map((d) => (
                    <tr key={d.name}>
                      <td className="py-2 pr-4 text-ink">{d.name}</td>
                      <td className="py-2 pr-4 text-ink">{d.people}</td>
                      <td className="py-2 pr-4 text-ink">{pct(d.covered, d.people)}</td>
                      <td className="py-2">
                        <span className="block h-2 rounded-full bg-border">
                          <span className="block h-2 rounded-full bg-[var(--brand)]" style={{ width: pct(d.covered, d.people) }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {a.campaigns.length ? (
            <Card>
              <CardHeader title="Campaign clicks, last 30 days" />
              <DailyBars daily={daily} label={`Banner clicks per day for the last 30 days: ${daily.join(", ")}`} />
              <ul className="mt-5 flex flex-col divide-y divide-border">
                {a.campaigns.slice(0, 10).map((r) => (
                  <li key={r.campaign.id} className="flex flex-wrap items-center gap-3 py-2 text-callout">
                    <Link href={`/app/campaigns/${r.campaign.id}`} className="font-semibold text-link hover:underline">
                      {r.campaign.name}
                    </Link>
                    <StateChip state={r.state} />
                    <span className="ml-auto tabular-nums text-ink">
                      {r.clicks30} <span className="text-ink-muted">of {r.clicks} all time</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : (
        <Alert tone="info">
          For a team your size the score says most of it.{" "}
          <Link href="/app/analytics?detail=1" className="font-semibold text-link hover:underline">
            See the detailed report
          </Link>
        </Alert>
      )}
    </div>
  );
}

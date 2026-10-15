import { healthScore, type Health } from "@/lib/analytics/health";
import { checkBrand, type BrandFinding } from "@/lib/signature/brand-check";
import { resolveAssignments } from "@/lib/signature/rules";
import { campaignReports, type CampaignReport } from "@/server/campaigns/service";
import type { Tx } from "@/server/db";
import { coverageOf, type CoverageStatus } from "@/server/delivery/coverage";
import { kitFor, toBrandData } from "@/server/signatures/brand";
import { contentOf, liveRules } from "@/server/signatures/templates";

/**
 * The reports page: whether signatures are reaching people, whether
 * updates work, how campaign banners do, and whether everything is on
 * brand. Small teams get a score and a few tips; larger ones the detail.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Above this many people, the reports open on the detail rather than the score. */
export const DETAILED_FROM = 16;

export interface Analytics {
  people: number;
  coverage: Record<CoverageStatus, number>;
  delivery: { target: "GMAIL" | "OUTLOOK"; applied: number; failed: number; waiting: number }[];
  departments: { name: string; people: number; covered: number }[];
  connected: boolean;
  syncedRecently: boolean;
  campaigns: CampaignReport[];
  brand: BrandFinding[];
  health: Health;
  detailed: boolean;
}

export async function analytics(tx: Tx, organisationId: string, origin: string, now = new Date()): Promise<Analytics> {
  const since = new Date(now.getTime() - 30 * DAY);
  const [people, rules, google, addin, deliveries, connections, templates, campaigns] = await Promise.all([
    tx.person.findMany({
      where: { active: true },
      select: { id: true, department: true, location: true, groups: true, source: true, title: true, phone: true, mobile: true, deliveries: true },
    }),
    liveRules(tx),
    tx.directoryConnection.findFirst({ where: { provider: "GOOGLE" }, select: { pushEnabled: true, status: true } }),
    tx.outlookAddin.findFirst({ select: { id: true } }),
    tx.signatureDelivery.groupBy({ by: ["target", "state"], where: { updatedAt: { gte: since } }, _count: { _all: true } }),
    tx.directoryConnection.findMany({ select: { status: true, lastSyncAt: true } }),
    tx.signatureTemplate.findMany({ where: { archivedAt: null, publishedVersionId: { not: null } }, include: { published: true } }),
    campaignReports(tx, now),
  ]);

  const googlePush = !!google?.pushEnabled && google.status !== "PENDING";
  const coverage: Record<CoverageStatus, number> = { covered: 0, waiting: 0, problem: 0, missing: 0 };
  const byDept = new Map<string, { people: number; covered: number }>();
  for (const p of people) {
    const r = resolveAssignments(p, rules);
    const status = coverageOf(
      {
        hasRule: !!(r.newEmail ?? r.reply),
        inGoogle: p.source === "GOOGLE",
        googlePush,
        addinDeployed: !!addin,
        gmail: p.deliveries.find((d) => d.target === "GMAIL") ?? null,
        outlook: p.deliveries.find((d) => d.target === "OUTLOOK") ?? null,
      },
      now,
    ).status;
    coverage[status]++;
    const name = p.department.trim() || "No department";
    const d = byDept.get(name) ?? { people: 0, covered: 0 };
    d.people++;
    if (status === "covered") d.covered++;
    byDept.set(name, d);
  }

  const count = (target: string, states: string[]) =>
    deliveries.filter((d) => d.target === target && states.includes(d.state)).reduce((n, d) => n + d._count._all, 0);
  const delivery = (["GMAIL", "OUTLOOK"] as const).map((target) => ({
    target,
    applied: count(target, ["APPLIED"]),
    failed: count(target, ["FAILED"]),
    waiting: count(target, ["PENDING"]),
  }));

  const kits = new Map<string | null, Promise<ReturnType<typeof toBrandData>>>();
  const brandOf = (id: string | null) => {
    if (!kits.has(id)) kits.set(id, kitFor(tx, organisationId, id).then((k) => toBrandData(k, origin)));
    return kits.get(id)!;
  };
  const checked = await Promise.all(
    templates
      .filter((t) => t.published)
      .map(async (t) => {
        const b = await brandOf(t.brandKitId);
        return { name: t.name, content: contentOf(t.published!.kind, t.published!.content), brand: { colours: b.colours, hasLogo: !!b.logo, hasDisclaimer: !!b.disclaimer.trim() } };
      }),
  );
  const brand = checkBrand(checked, {
    people: people.length,
    noTitle: people.filter((p) => !p.title.trim()).length,
    noPhone: people.filter((p) => !p.phone.trim() && !p.mobile.trim()).length,
  });

  const connected = connections.some((c) => c.status === "CONNECTED" || c.status === "ERROR");
  const syncedRecently = connections.some((c) => !!c.lastSyncAt && now.getTime() - c.lastSyncAt.getTime() < DAY);
  const applied = delivery.reduce((n, d) => n + d.applied, 0);
  const failed = delivery.reduce((n, d) => n + d.failed, 0);
  return {
    people: people.length,
    coverage,
    delivery,
    departments: [...byDept.entries()].map(([name, d]) => ({ name, ...d })).sort((a, b) => b.people - a.people || a.name.localeCompare(b.name)),
    connected,
    syncedRecently,
    campaigns,
    brand,
    health: healthScore({
      people: people.length,
      covered: coverage.covered,
      problems: coverage.problem,
      missing: coverage.missing,
      applied,
      failed,
      connected,
      syncedRecently,
      brandWarnings: brand.filter((f) => f.severity === "warning").length,
    }),
    detailed: people.length >= DETAILED_FROM,
  };
}

import { Archive, FilePlus2, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SignatureThumb } from "@/components/signatures/thumb";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { renderHtmlSignature } from "@/lib/signature/html-mode";
import { renderSignature } from "@/lib/signature/render";
import { SAMPLE_PERSON } from "@/lib/signature/fields";
import { kitOptions, origin } from "@/server/signatures/studio-data";
import { assetsFor, contentOf } from "@/server/signatures/templates";

import { describeRule } from "@/lib/signature/rules";

export const metadata: Metadata = { title: "Signatures" };


export default async function SignaturesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { actor, organisation } = await requireMember();
  const showArchived = (await searchParams).archived === "1";
  const o = origin();
  const { templates, previews } = await asTenant(organisation.id, async (tx) => {
    const kits = await kitOptions(tx, organisation.id);
    const templates = await tx.signatureTemplate.findMany({
      where: { archivedAt: showArchived ? { not: null } : null },
      orderBy: { updatedAt: "desc" },
      include: { published: { select: { number: true, createdAt: true } }, assignments: { select: { scope: true, department: true, groupName: true, location: true, forNew: true, forReply: true, audience: true } } },
    });
    const previews: Record<string, string> = {};
    for (const t of templates) {
      const kit = kits.find((k) => k.id === t.brandKitId) ?? kits[0];
      const c = contentOf(t.kind, t.draft);
      previews[t.id] =
        c.kind === "HTML"
          ? renderHtmlSignature(c.html, { brand: kit.brand, person: SAMPLE_PERSON }).html
          : renderSignature(c.doc, { brand: kit.brand, person: SAMPLE_PERSON, assets: await assetsFor(tx, c.doc, o), origin: o }).html;
    }
    return { templates, previews };
  });
  const manage = can(actor, "manageTemplates");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={organisation.name}
        title={showArchived ? "Archived signatures" : "Signatures"}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={showArchived ? "/app/signatures" : "/app/signatures?archived=1"}>
                <Archive /> {showArchived ? "Current signatures" : "Archived"}
              </Link>
            </Button>
            {manage ? (
              <Button asChild>
                <Link href="/app/signatures/new">
                  <FilePlus2 /> New signature
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      {templates.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title={showArchived ? "Nothing archived" : "No signatures yet"}
          action={
            manage && !showArchived ? (
              <Button asChild>
                <Link href="/app/signatures/new">Start from a template</Link>
              </Button>
            ) : null
          }
        >
          {showArchived ? "Signatures you archive appear here, and can be restored." : "Pick a starter template, build one from blocks, or paste your own HTML."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => {
            const pending = !t.published || t.updatedAt.getTime() > t.published.createdAt.getTime() + 1000;
            const rules = t.assignments.length;
            return (
              <li key={t.id}>
                <Link href={`/app/signatures/${t.id}`} className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong">
                  <SignatureThumb html={previews[t.id]} title={t.name} />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{t.name}</span>
                    <span className="text-callout text-ink-muted">
                      {t.kind === "HTML" ? "HTML" : "Built in the studio"} ·{" "}
                      {t.published ? `version ${t.published.number} live${pending ? ", newer draft" : ""}` : "not published"} ·{" "}
                      {rules === 0
                        ? "not given to anyone"
                        : rules === 1
                          ? `given to ${describeRule(t.assignments[0], "one person").who.replace(/^Everyone$/, "everyone")}`
                          : `${rules} rules`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { Code2, LayoutTemplate } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SignatureThumb } from "@/components/signatures/thumb";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { SAMPLE_PERSON } from "@/lib/signature/fields";
import { renderSignature } from "@/lib/signature/render";
import { INDUSTRIES, STARTERS } from "@/lib/signature/starters";
import { kitOptions, origin } from "@/server/signatures/studio-data";
import { createTemplateAction } from "../actions";
import { aiAvailable } from "@/server/ai/claude";
import { DraftWithClaude } from "./draft-with-claude";
import { IndustryFilter } from "./industry-filter";

export const metadata: Metadata = { title: "New signature" };

export default async function NewSignaturePage({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { actor, organisation } = await requireMember();
  if (!can(actor, "manageTemplates")) notFound();
  const industry = (await searchParams).industry ?? "";
  const kits = await asTenant(organisation.id, (tx) => kitOptions(tx, organisation.id));
  const kit = kits[0];
  const o = origin();
  const shown = STARTERS.filter((s) => !industry || s.industry === industry);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Signatures" title="Start a signature" />
      <div className="grid gap-4 sm:grid-cols-2">
        <form action={createTemplateAction}>
          <input type="hidden" name="kind" value="VISUAL" />
          <input type="hidden" name="name" value="New signature" />
          <button className="flex h-full w-full items-start gap-4 rounded-lg border border-border bg-surface-1 p-5 text-left hover:border-border-strong">
            <LayoutTemplate aria-hidden className="mt-0.5 size-6 shrink-0 text-link" />
            <span className="flex flex-col gap-1">
              <span className="font-semibold text-ink">Start blank</span>
              <span className="text-callout text-ink-muted">Build it from blocks: name, photo, contact details, logo, social icons and more.</span>
            </span>
          </button>
        </form>
        <form action={createTemplateAction}>
          <input type="hidden" name="kind" value="HTML" />
          <button className="flex h-full w-full items-start gap-4 rounded-lg border border-border bg-surface-1 p-5 text-left hover:border-border-strong">
            <Code2 aria-hidden className="mt-0.5 size-6 shrink-0 text-link" />
            <span className="flex flex-col gap-1">
              <span className="font-semibold text-ink">Write HTML</span>
              <span className="text-callout text-ink-muted">Paste a signature your designer made. We check it against Outlook, Gmail and Apple Mail as you go.</span>
            </span>
          </button>
        </form>
      </div>

      {aiAvailable() ? (
        <Card>
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-headline text-ink">Or describe it, and Claude drafts it</h2>
            <p className="text-callout text-ink-muted">Say what you want in your own words. It opens in the studio as a draft.</p>
          </div>
          <DraftWithClaude kits={kits.map((k) => ({ id: k.id, name: k.name }))} />
        </Card>
      ) : null}

      <Card>
        <div className="mb-5 flex flex-col gap-3">
          <h2 className="text-headline text-ink">Or start from one of {STARTERS.length} templates</h2>
          <p className="text-callout text-ink-muted">
            Shown in your {kit.name} colours. Everything can be changed once you open it.
          </p>
          <IndustryFilter industries={[...INDUSTRIES]} current={industry} />
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((s) => (
            <li key={s.key} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <SignatureThumb html={renderSignature(s.doc, { brand: kit.brand, person: SAMPLE_PERSON, assets: {}, origin: o }).html} title={s.name} />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-caption font-semibold uppercase tracking-wide text-link">{s.industry}</span>
                  <span className="font-semibold text-ink">{s.name}</span>
                  <span className="text-callout text-ink-muted">{s.description}</span>
                </div>
                <form action={createTemplateAction}>
                  <input type="hidden" name="kind" value="VISUAL" />
                  <input type="hidden" name="starter" value={s.key} />
                  <input type="hidden" name="name" value={`${s.industry}: ${s.name}`} />
                  <button className="h-9 rounded-md bg-brand px-3 text-callout font-semibold text-on-brand hover:bg-brand/90">Use this</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

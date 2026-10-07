import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/site/section";
import { SignatureThumb } from "@/components/signatures/thumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { INDUSTRIES, STARTERS } from "@/lib/signature/starters";
import { PALETTES, palette } from "@/lib/site/samples";
import { sampleHtml } from "@/server/site";

export const metadata: Metadata = {
  title: "Email signature templates",
  description: `${STARTERS.length} professional email signature templates by industry, for Gmail and Outlook. See each one in your colours, then use it free.`,
};
export const dynamic = "force-dynamic";

const chip = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center rounded-full border px-3.5 text-callout whitespace-nowrap",
    active ? "border-transparent bg-mark-tile font-semibold text-white" : "border-border bg-surface-1 text-ink hover:border-border-strong",
  );

function href(industry: string, colour: string) {
  const q = new URLSearchParams();
  if (industry) q.set("industry", industry);
  if (colour && colour !== PALETTES[0].key) q.set("colour", colour);
  const s = q.toString();
  return s ? `/templates?${s}` : "/templates";
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ industry?: string; colour?: string }> }) {
  const sp = await searchParams;
  const industry = (INDUSTRIES as readonly string[]).includes(sp.industry ?? "") ? sp.industry! : "";
  const p = palette(sp.colour);
  const shown = STARTERS.filter((s) => !industry || s.industry === industry);

  return (
    <Section className="pt-10 sm:pt-16">
      <div className="mb-8 flex max-w-[720px] flex-col gap-3">
        <h1 className="text-[34px] leading-[40px] font-bold tracking-[-0.03em] text-ink sm:text-[44px] sm:leading-[50px]">Email signature templates</h1>
        <p className="text-[17px] leading-7 text-ink-muted">
          {STARTERS.length} templates, tested in Outlook, Gmail and Apple Mail. Each one takes on your logo and colours, and every person&apos;s details fill in from
          your directory.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-4">
        <nav aria-label="Industry" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 pb-1 sm:flex-wrap">
            <li>
              <Link href={href("", p.key)} className={chip(!industry)} aria-current={!industry ? "page" : undefined}>
                All industries
              </Link>
            </li>
            {INDUSTRIES.map((i) => (
              <li key={i}>
                <Link href={href(i, p.key)} className={chip(industry === i)} aria-current={industry === i ? "page" : undefined}>
                  {i}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-callout text-ink-muted">Shown in</span>
          <ul className="flex gap-2">
            {PALETTES.map((c) => (
              <li key={c.key}>
                <Link
                  href={href(industry, c.key)}
                  aria-label={c.name}
                  aria-current={c.key === p.key ? "true" : undefined}
                  className={cn("block size-8 rounded-full border-2", c.key === p.key ? "border-ink" : "border-transparent")}
                  style={{ background: c.primary }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="grid gap-6 md:grid-cols-2">
        {shown.map((s) => (
          <li key={s.key}>
            <Link
              href={`/templates/${s.key}${p.key === PALETTES[0].key ? "" : `?colour=${p.key}`}`}
              className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-surface-1 p-4 hover:border-border-strong sm:p-5"
            >
              <SignatureThumb html={sampleHtml(s.doc, p)} title={s.name} />
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-headline text-ink group-hover:underline">{s.name}</span>
                  <span className="text-caption font-semibold tracking-wide text-ink-muted uppercase">{s.industry}</span>
                </span>
                <span className="text-callout text-ink-muted">{s.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-col items-start gap-4 rounded-lg border border-border bg-surface-1 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-title-2 text-ink">Have a design already?</h2>
          <p className="text-body text-ink-muted">Paste your designer&apos;s HTML in the studio. We check it against every major mail app as you go.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/sign-up">Start free</Link>
        </Button>
      </div>
    </Section>
  );
}

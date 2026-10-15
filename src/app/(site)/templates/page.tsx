import type { Metadata } from "next";
import Link from "next/link";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { SignatureThumb } from "@/components/signatures/thumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { INDUSTRIES, STARTERS } from "@/lib/signature/starters";
import { PALETTES, palette } from "@/lib/site/samples";
import { sampleHtml } from "@/server/site";

export const metadata: Metadata = {
  title: "Email signature templates",
  description: `${STARTERS.length} email signature templates for Gmail and Outlook, by industry. Try any of them with your own logo, photo and graphics before you sign up.`,
};
export const dynamic = "force-dynamic";

const chip = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center rounded-full border px-3.5 text-callout whitespace-nowrap",
    active ? "border-transparent bg-brand font-semibold text-on-brand" : "border-border bg-surface-1 text-ink hover:border-border-strong",
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
    <Section className="pt-14 sm:pt-20">
      <div className="mb-12 flex max-w-[760px] flex-col gap-5">
        <Eyebrow>Templates</Eyebrow>
        <Display as="h1">Start from a design. Make it entirely yours.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">
          {STARTERS.length} templates, each tested in Outlook, Gmail and Apple Mail. Open one to try it with your own logo, photo and graphics. Your people&apos;s
          names and numbers fill in from your directory once you sign up.
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
          <span className="text-callout text-ink-muted">Preview in</span>
          <ul className="flex gap-2">
            {PALETTES.map((c) => (
              <li key={c.key}>
                <Link
                  href={href(industry, c.key)}
                  aria-label={c.name}
                  aria-current={c.key === p.key ? "true" : undefined}
                  title={c.name}
                  className={cn("block size-7 rounded-full ring-offset-2 ring-offset-surface-0", c.key === p.key ? "ring-2 ring-ink" : "")}
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
              className="group flex h-full flex-col gap-5 rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong sm:p-5"
            >
              <SignatureThumb html={sampleHtml(s, p)} title={s.name} />
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-[26px] leading-8 text-ink">{s.name}</span>
                  <span className="text-[12px] font-semibold tracking-[0.14em] text-ink-muted uppercase">{s.industry}</span>
                </span>
                <span className="text-callout text-ink-muted">{s.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-16 flex flex-col items-start gap-6 rounded-xl bg-brand p-8 text-on-brand sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="flex max-w-[640px] flex-col gap-2">
          <h2 className="font-display text-[32px] leading-[38px]">Already have a signature you like?</h2>
          <p className="text-[16px] leading-7 opacity-80">Paste the HTML your designer made into the studio. We check it against Outlook, Gmail and Apple Mail as you go and tell you what to fix.</p>
        </div>
        <Button asChild size="lg" variant="secondary" className="shrink-0 border-transparent">
          <Link href="/sign-up">Start your free trial</Link>
        </Button>
      </div>
    </Section>
  );
}

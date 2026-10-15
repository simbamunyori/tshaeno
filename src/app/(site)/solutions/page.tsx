import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand } from "@/components/site/cta-band";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { INDUSTRY_LABEL } from "@/lib/site/nav";
import { INDUSTRY_SOLUTIONS } from "@/lib/site/solutions";
import { TEAM_SOLUTIONS } from "@/lib/site/teams";

export const metadata: Metadata = {
  title: "Solutions",
  description: "How Tshaeno works for IT, marketing, sales and HR teams, and for firms in law, finance, healthcare, property and twelve other industries.",
};

export default function SolutionsPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mb-14 flex max-w-[760px] flex-col gap-5">
        <Eyebrow>Solutions</Eyebrow>
        <Display as="h1">Built around the way your company already works.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">
          Every team wants something different from a signature. IT wants fewer requests, marketing wants the brand right, sales wants meetings booked. Start with your team or your industry.
        </p>
      </div>

      <h2 className="mb-6 text-[12px] font-semibold tracking-[0.16em] text-ink-muted uppercase">By team</h2>
      <ul className="mb-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEAM_SOLUTIONS.map((t) => (
          <li key={t.slug}>
            <Link href={`/solutions/${t.slug}`} className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-surface-1 p-6 hover:border-border-strong">
              <span className="font-display text-[28px] leading-8 text-ink">{t.label}</span>
              <span className="flex-1 text-callout text-ink-muted">{t.headline}</span>
              <ArrowRight aria-hidden className="size-4 text-accent transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mb-6 text-[12px] font-semibold tracking-[0.16em] text-ink-muted uppercase">By industry</h2>
      <ul className="grid gap-x-8 border-t border-border sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRY_SOLUTIONS.map((s) => (
          <li key={s.slug} className="border-b border-border">
            <Link href={`/solutions/${s.slug}`} className="group flex flex-col gap-1 py-5">
              <span className="flex items-center justify-between gap-3 text-[18px] font-semibold text-ink">
                {INDUSTRY_LABEL(s.industry)}
                <ArrowRight aria-hidden className="size-4 text-accent transition-transform group-hover:translate-x-1" />
              </span>
              <span className="text-callout text-ink-muted">{s.headline}</span>
            </Link>
          </li>
        ))}
      </ul>
      <CtaBand />
    </Section>
  );
}

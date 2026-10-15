import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/site/cta-band";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { GUIDES, type Guide } from "@/lib/site/guides";

export const metadata: Metadata = {
  title: "Guides",
  description: "Practical guides to email signatures, disclaimers, out-of-office replies, signature banners and meeting backgrounds.",
};

const ORDER: Guide["category"][] = ["Getting started", "Design", "Compliance", "Everyday email"];

export default function GuidesPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mb-14 flex max-w-[760px] flex-col gap-5">
        <Eyebrow>Guides</Eyebrow>
        <Display as="h1">Practical advice on the emails your company sends every day.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">Written for the person who has to make signatures work, whether or not they asked for the job.</p>
      </div>
      <div className="flex flex-col gap-14">
        {ORDER.map((cat) => {
          const list = GUIDES.filter((g) => g.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="mb-5 text-[12px] font-semibold tracking-[0.16em] text-ink-muted uppercase">
                {cat}
              </h2>
              <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {list.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/guides/${g.slug}`} className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface-1 p-6 hover:border-border-strong">
                      <span className="font-display text-[26px] leading-[32px] text-ink">{g.title}</span>
                      <span className="flex-1 text-callout text-ink-muted">{g.summary}</span>
                      <span className="text-caption text-ink-muted">{g.minutes} minute read</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <CtaBand />
    </Section>
  );
}

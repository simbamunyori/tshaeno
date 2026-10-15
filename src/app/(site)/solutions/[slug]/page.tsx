import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/cta-band";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { SignatureThumb } from "@/components/signatures/thumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { STARTERS, starter } from "@/lib/signature/starters";
import { INDUSTRY_LABEL } from "@/lib/site/nav";
import { palette } from "@/lib/site/samples";
import { industrySolution } from "@/lib/site/solutions";
import { teamSolution } from "@/lib/site/teams";
import { sampleHtml } from "@/server/site";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const team = teamSolution(slug);
  if (team) return { title: `Email signatures for ${team.label} teams`, description: team.intro };
  const ind = industrySolution(slug);
  if (ind) return { title: `Email signatures for ${INDUSTRY_LABEL(ind.industry).toLowerCase()}`, description: ind.intro };
  return {};
}

function Hero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <div className="mb-16 flex max-w-[820px] flex-col gap-5">
      <Eyebrow>
        <Link href="/solutions" className="hover:text-ink">
          Solutions
        </Link>{" "}
        / {eyebrow}
      </Eyebrow>
      <Display as="h1">{title}</Display>
      <p className="text-[18px] leading-[30px] text-ink-muted">{intro}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">Start your 14-day trial</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/demo">Book a demo</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function SolutionPage({ params }: Params) {
  const { slug } = await params;
  const team = teamSolution(slug);
  if (team) {
    return (
      <Section className="pt-14 sm:pt-20">
        <Hero eyebrow={team.label} title={team.headline} intro={team.intro} />
        <div className="flex flex-col gap-16 sm:gap-24">
          {team.rows.map((r, i) => {
            const s = starter(r.starter) ?? STARTERS[0];
            return (
              <div key={r.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                <div className={cn("flex flex-col gap-4", i % 2 ? "lg:order-2" : "")}>
                  <span className="font-display text-[44px] leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="font-display text-[34px] leading-[40px] text-ink">{r.title}</h2>
                  <p className="text-[17px] leading-7 text-ink-muted">{r.text}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-1 p-4 sm:p-6">
                  <SignatureThumb html={sampleHtml(s, palette(r.colour))} title={s.name} />
                </div>
              </div>
            );
          })}
        </div>
        <Questions items={team.questions} />
        <CtaBand />
      </Section>
    );
  }

  const ind = industrySolution(slug);
  if (!ind) notFound();
  const starters = STARTERS.filter((s) => s.industry === ind.industry);
  return (
    <Section className="pt-14 sm:pt-20">
      <Hero eyebrow={INDUSTRY_LABEL(ind.industry)} title={ind.headline} intro={ind.intro} />
      <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
        {ind.needs.map((n) => (
          <li key={n.title} className="flex flex-col gap-3 bg-surface-1 p-6 sm:p-8">
            <span aria-hidden className="h-px w-8 bg-accent" />
            <h2 className="text-[19px] leading-7 font-semibold text-ink">{n.title}</h2>
            <p className="text-callout text-ink-muted">{n.text}</p>
          </li>
        ))}
      </ul>

      <figure className="my-20 max-w-[900px] border-l-2 border-accent pl-6 sm:pl-10">
        <figcaption className="mb-4 text-[12px] font-semibold tracking-[0.16em] text-ink-muted uppercase">How it might look in practice</figcaption>
        <p className="font-display text-[26px] leading-[36px] text-ink sm:text-[30px] sm:leading-[42px]">{ind.scenario}</p>
      </figure>

      {starters.length ? (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-[34px] leading-[40px] text-ink">Templates for {INDUSTRY_LABEL(ind.industry).toLowerCase()}</h2>
            <Link href={`/templates?industry=${encodeURIComponent(ind.industry)}`} className="text-callout font-semibold text-link hover:underline">
              See them all in the gallery
            </Link>
          </div>
          <ul className="grid gap-6 md:grid-cols-2">
            {starters.map((s) => (
              <li key={s.key}>
                <Link href={`/templates/${s.key}`} className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface-1 p-4 hover:border-border-strong sm:p-5">
                  <SignatureThumb html={sampleHtml(s, palette(null))} title={s.name} />
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-[24px] leading-8 text-ink">{s.name}</span>
                    <span className="text-callout text-ink-muted">{s.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <CtaBand />
    </Section>
  );
}

function Questions({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-24 grid gap-10 lg:grid-cols-[320px_1fr]">
      <h2 className="font-display text-[34px] leading-[40px] text-ink">Questions we hear</h2>
      <dl className="flex flex-col divide-y divide-border border-y border-border">
        {items.map(([q, a]) => (
          <div key={q} className="flex flex-col gap-2 py-6">
            <dt className="text-[18px] font-semibold text-ink">{q}</dt>
            <dd className="text-[16px] leading-7 text-ink-muted">{a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

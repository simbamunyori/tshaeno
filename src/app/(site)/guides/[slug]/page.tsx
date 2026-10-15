import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/site/cta-band";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { GUIDES, guide } from "@/lib/site/guides";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const g = guide((await params).slug);
  return g ? { title: g.title, description: g.summary } : {};
}

const TOOL: Record<string, { href: string; label: string }> = {
  "email-disclaimers": { href: "/tools/disclaimer", label: "Write your disclaimer" },
  "out-of-office-messages": { href: "/tools/out-of-office", label: "Write your out-of-office reply" },
  "branded-meeting-backgrounds": { href: "/tools/meeting-background", label: "Make your background" },
};

export default async function GuidePage({ params }: Params) {
  const g = guide((await params).slug);
  if (!g) notFound();
  const tool = TOOL[g.slug];
  const more = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  return (
    <Section className="pt-14 sm:pt-20">
      <article className="mx-auto max-w-[720px]">
        <Eyebrow>
          <Link href="/guides" className="hover:text-ink">
            Guides
          </Link>{" "}
          / {g.category}
        </Eyebrow>
        <Display as="h1" className="mt-5">
          {g.title}
        </Display>
        <p className="mt-6 text-[19px] leading-[32px] text-ink-muted">{g.summary}</p>
        <p className="mt-4 text-caption text-ink-muted">{g.minutes} minute read</p>
        {tool ? (
          <Link href={tool.href} className="mt-8 inline-flex rounded-md border border-border-strong bg-surface-1 px-4 py-3 text-callout font-semibold text-ink hover:bg-surface-2">
            {tool.label} with our free tool
          </Link>
        ) : null}
        <div className="mt-12 flex flex-col gap-10 border-t border-border pt-10">
          {g.sections.map((s) => (
            <section key={s.heading} className="flex flex-col gap-4">
              <h2 className="font-display text-[30px] leading-[36px] text-ink">{s.heading}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-[17px] leading-[30px] text-ink">
                  {p}
                </p>
              ))}
              {s.list ? (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-[17px] leading-[28px] text-ink marker:text-accent">
                  {s.list.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
      <div className="mx-auto mt-20 max-w-[1200px]">
        <h2 className="mb-6 text-[12px] font-semibold tracking-[0.16em] text-ink-muted uppercase">More guides</h2>
        <ul className="grid gap-5 md:grid-cols-3">
          {more.map((m) => (
            <li key={m.slug}>
              <Link href={`/guides/${m.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface-1 p-6 hover:border-border-strong">
                <span className="font-display text-[22px] leading-[28px] text-ink">{m.title}</span>
                <span className="text-caption text-ink-muted">{m.minutes} minute read</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <CtaBand />
    </Section>
  );
}

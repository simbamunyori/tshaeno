import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { SignatureThumb } from "@/components/signatures/thumb";
import { STARTERS, starter } from "@/lib/signature/starters";
import { PALETTES, palette } from "@/lib/site/samples";
import { origin } from "@/server/signatures/studio-data";
import { sampleHtml } from "@/server/site";
import { TryTemplate } from "./try-template";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const s = starter((await params).key);
  if (!s) return {};
  return { title: `${s.name}: a ${s.industry.toLowerCase()} email signature template`, description: `${s.description} Try it with your own logo and colours before you sign up.` };
}

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ colour?: string }> }) {
  const s = starter((await params).key);
  if (!s) notFound();
  const p = palette((await searchParams).colour);
  const more = STARTERS.filter((x) => x.key !== s.key && x.industry === s.industry)
    .concat(STARTERS.filter((x) => x.industry !== s.industry && x.industry === "General"))
    .slice(0, 2);

  return (
    <Section className="pt-10 sm:pt-14">
      <Link href="/templates" className="mb-6 inline-flex items-center gap-1.5 text-callout font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        All templates
      </Link>
      <div className="mb-10 flex flex-col gap-4">
        <Eyebrow>{s.industry}</Eyebrow>
        <Display as="h1">{s.name}</Display>
        <p className="max-w-[640px] text-[18px] leading-[30px] text-ink-muted">{s.description}</p>
      </div>

      <TryTemplate doc={s.doc} templateKey={s.key} industry={s.industry} showsGraphic={s.graphic} origin={origin()} palettes={PALETTES} initialPalette={p.key} />

      {more.length ? (
        <div className="mt-16">
          <h2 className="mb-6 font-display text-[34px] leading-10 text-ink">More like this</h2>
          <ul className="grid gap-6 md:grid-cols-2">
            {more.map((m) => (
              <li key={m.key}>
                <Link href={`/templates/${m.key}`} className="group flex h-full flex-col gap-4 rounded-xl border border-border bg-surface-1 p-4 hover:border-border-strong sm:p-5">
                  <SignatureThumb html={sampleHtml(m, p)} title={m.name} />
                  <span className="font-display text-[24px] leading-8 text-ink">{m.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

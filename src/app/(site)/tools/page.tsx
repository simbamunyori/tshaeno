import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand } from "@/components/site/cta-band";
import { Display, Eyebrow, Section } from "@/components/site/section";

export const metadata: Metadata = {
  title: "Free tools",
  description: "Free tools for business email: a branded meeting background maker, an out-of-office reply writer and an email disclaimer writer.",
};

const TOOLS = [
  { href: "/tools/meeting-background", title: "Meeting background maker", text: "A full HD background for Zoom, Teams and Meet with your logo, name and title." },
  { href: "/tools/out-of-office", title: "Out-of-office writer", text: "A clear reply that says when you're back and who can help while you're away." },
  { href: "/tools/disclaimer", title: "Email disclaimer writer", text: "Two or three plain sentences, built from only the parts your business needs." },
];

export default function ToolsPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mb-14 flex max-w-[760px] flex-col gap-5">
        <Eyebrow>Free tools</Eyebrow>
        <Display as="h1">Small jobs, done properly.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">No sign-up and nothing uploaded. Everything you type stays in your browser.</p>
      </div>
      <ul className="grid gap-5 md:grid-cols-3">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-surface-1 p-7 hover:border-border-strong">
              <span className="font-display text-[28px] leading-[34px] text-ink">{t.title}</span>
              <span className="flex-1 text-callout text-ink-muted">{t.text}</span>
              <ArrowRight aria-hidden className="size-4 text-accent transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
      <CtaBand title="Want this done for every person, automatically?" text="Tshaeno sets signatures and disclaimers for the whole company from one place. Try it free for 14 days." />
    </Section>
  );
}

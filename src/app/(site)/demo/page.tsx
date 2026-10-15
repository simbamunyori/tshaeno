import type { Metadata } from "next";
import Link from "next/link";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { DemoForm } from "./demo-form";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "Half an hour with someone from Tshaeno. We'll set up a signature with your own logo and show you how it reaches everyone in Gmail and Outlook.",
};

const AGENDA = [
  ["Your signature, not a sample", "Send us your logo before the call and we'll build your first signature with you, live."],
  ["How it reaches everyone", "We'll show you the Gmail and Outlook set-up for your own directory, and what your IT team needs to do."],
  ["Your questions", "Pricing, security, rules for different offices, moving from another tool. Whatever you need to decide."],
] as const;

export default function DemoPage() {
  return (
    <Section className="pt-14 sm:pt-20" inner="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
      <div className="flex flex-col gap-6">
        <Eyebrow>Book a demo</Eyebrow>
        <Display as="h1">Half an hour, and you&apos;ll see it working with your own logo.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">
          Tell us a little about your company and we&apos;ll email you to find a time that suits you.
        </p>
        <dl className="mt-2 flex flex-col border-t border-border">
          {AGENDA.map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 border-b border-border py-5">
              <dt className="text-[17px] leading-7 font-semibold text-ink">{t}</dt>
              <dd className="text-[15px] leading-6 text-ink-muted">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[15px] text-ink-muted">
          Prefer to look around on your own?{" "}
          <Link href="/sign-up" className="font-semibold text-link hover:underline">
            Start a {TRIAL_DAYS}-day trial
          </Link>{" "}
          instead. No card needed.
        </p>
      </div>
      <div className="relative self-start rounded-xl border border-border bg-surface-1 p-6 shadow-elevation-2 sm:p-10">
        <DemoForm />
      </div>
    </Section>
  );
}

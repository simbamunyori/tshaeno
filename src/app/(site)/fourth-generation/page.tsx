import type { Metadata } from "next";
import Link from "next/link";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { marketplaceUrl } from "@/server/site";

export const metadata: Metadata = {
  title: "Buying through Fourth Generation Technologies",
  description: "Add Tshaeno from the Fourth Generation marketplace: set up for you, billed on your Fourth Generation invoice. Email signatures are free for Fourth Generation hosting customers who move to the Tshaeno console.",
};
export const dynamic = "force-dynamic";

const STEPS = [
  ["Add Tshaeno in the marketplace", "Choose Tshaeno in the Fourth Generation marketplace, or ask your Fourth Generation account manager to add it."],
  ["Your organisation is created for you", "We set up your Tshaeno organisation and email an invitation to the person you name."],
  ["Sign in with your Fourth Generation account", "Use Continue with Fourth Generation on the sign-in page. No new password to remember."],
  ["Upgrade when you want more", "Signatures stay free. If you want campaigns or the other paid features, upgrade and it goes on your Fourth Generation invoice."],
] as const;

const FREE = [
  "A managed signature for every mailbox",
  "All templates, with your own logo and colours",
  "Details filled in from your directory",
  "Gmail and Outlook, set from one place",
  "Your legal disclaimer on every email",
];

const PAID = [
  "Campaign banners under every signature",
  "Click reports by campaign and team",
  "Meeting backgrounds for everyone",
  "Out-of-office replies set for people",
  "Signature drafts and brand reviews by Claude",
];

export default function FourthGenerationPage() {
  const market = marketplaceUrl();
  return (
    <>
      <Section className="pt-14 sm:pt-20" inner="max-w-[860px]">
        <Eyebrow>Fourth Generation Technologies</Eyebrow>
        <Display as="h1" className="mt-5">
          Buy Tshaeno through Fourth Generation
        </Display>
        <p className="mt-5 text-[18px] leading-[30px] text-ink-muted">
          Tshaeno is sold directly on this website and through the Fourth Generation Technologies marketplace. It is the same product either way. Buying through
          Fourth Generation keeps one supplier and one invoice for your email, apps and signatures.
        </p>
        <div className="mt-8 border-l-2 border-accent bg-surface-1 p-6">
          <p className="font-display text-[24px] leading-8 text-ink">Hosting with Fourth Generation? Your email signatures are free.</p>
          <p className="mt-1 text-body text-ink-muted">Move your signatures to the Tshaeno console and every mailbox you host with Fourth Generation gets one, for as many people as you have.</p>
        </div>
        <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          <div className="flex flex-col gap-3 bg-surface-1 p-6">
            <h2 className="text-[12px] font-semibold tracking-[0.16em] text-ink-muted uppercase">Included free</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink marker:text-accent">
              {FREE.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 bg-surface-1 p-6">
            <h2 className="text-[12px] font-semibold tracking-[0.16em] text-ink-muted uppercase">With a paid plan</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink marker:text-accent">
              {PAID.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-auto text-callout font-semibold text-link hover:underline">
              See the plans
            </Link>
          </div>
        </div>
      </Section>

      <Section className="pt-0 sm:pt-0" inner="max-w-[860px]">
        <h2 className="mb-6 font-display text-[34px] leading-10 text-ink">How it works</h2>
        <ol className="flex flex-col border-t border-border">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-6 border-b border-border py-6">
              <span aria-hidden className="w-10 shrink-0 font-display text-[36px] leading-none text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block text-headline text-ink">{t}</span>
                <span className="text-body text-ink-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          {market ? (
            <Button asChild size="lg">
              <a href={market}>Open the Fourth Generation marketplace</a>
            </Button>
          ) : null}
          <Button asChild size="lg" variant={market ? "secondary" : "primary"}>
            <Link href="/sign-in">Sign in with Fourth Generation</Link>
          </Button>
        </div>
        <p className="mt-8 text-callout text-ink-muted">
          Rather buy directly? <Link href="/sign-up" className="font-semibold text-link hover:underline">Start a free trial here</Link> and pay us by card or bank transfer.
        </p>
      </Section>
    </>
  );
}

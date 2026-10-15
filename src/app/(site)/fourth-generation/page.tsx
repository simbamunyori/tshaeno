import type { Metadata } from "next";
import Link from "next/link";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { marketplaceUrl } from "@/server/site";

export const metadata: Metadata = {
  title: "Buying through Fourth Generation Technologies",
  description: "Add Tshaeno from the Fourth Generation marketplace: set up for you, billed on your Fourth Generation invoice. Starter is free for Fourth Generation email customers.",
};
export const dynamic = "force-dynamic";

const STEPS = [
  ["Add Tshaeno in the marketplace", "Choose Tshaeno in the Fourth Generation marketplace, or ask your Fourth Generation account manager to add it."],
  ["Your organisation is created for you", "We set up your Tshaeno organisation and email an invitation to the person you name."],
  ["Sign in with your Fourth Generation account", "Use Continue with Fourth Generation on the sign-in page. No new password to remember."],
  ["Pay on the invoice you already get", "Tshaeno appears on your Fourth Generation invoice. Change the number of people through Fourth Generation, too."],
] as const;

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
          <p className="font-display text-[24px] leading-8 text-ink">Fourth Generation email customers get Tshaeno Starter free.</p>
          <p className="mt-1 text-body text-ink-muted">Add it from the marketplace and it is already paid for.</p>
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

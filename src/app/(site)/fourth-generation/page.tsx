import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/site/section";
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
      <Section className="pt-10 sm:pt-16" inner="max-w-[860px]">
        <p className="text-callout font-semibold tracking-wide text-link uppercase">Fourth Generation Technologies</p>
        <h1 className="mt-3 text-[34px] leading-[40px] font-bold tracking-[-0.03em] text-ink text-balance sm:text-[44px] sm:leading-[50px]">
          Buy Tshaeno through Fourth Generation
        </h1>
        <p className="mt-4 text-[17px] leading-7 text-ink-muted">
          Tshaeno is sold directly on this website and through the Fourth Generation Technologies marketplace. It is the same product either way. Buying through
          Fourth Generation keeps one supplier and one invoice for your email, apps and signatures.
        </p>
        <div className="mt-6 rounded-lg border border-brand bg-brand-soft p-5">
          <p className="text-headline text-ink">Fourth Generation email customers get Tshaeno Starter free.</p>
          <p className="mt-1 text-body text-ink-muted">Add it from the marketplace and it is already paid for.</p>
        </div>
      </Section>

      <Section className="pt-0 sm:pt-0" inner="max-w-[860px]">
        <h2 className="mb-6 text-title-2 text-ink">How it works</h2>
        <ol className="flex flex-col gap-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-lg border border-border bg-surface-1 p-5">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-headline text-link">
                {i + 1}
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
          Rather buy directly? <Link href="/sign-up" className="font-semibold text-link hover:underline">Start free here</Link> and pay us by card or bank transfer.
        </p>
      </Section>
    </>
  );
}

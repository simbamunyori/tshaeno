import { BarChart3, Building2, Check, LayoutTemplate, Megaphone, RefreshCw, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmailMock } from "@/components/site/email-mock";
import { Section, SectionTitle } from "@/components/site/section";
import { SignatureThumb } from "@/components/signatures/thumb";
import { Button } from "@/components/ui/button";
import { FREE_PEOPLE, TRIAL_DAYS } from "@/lib/billing/plans";
import { STARTERS, starter } from "@/lib/signature/starters";
import { palette } from "@/lib/site/samples";
import { sampleHtml } from "@/server/site";

export const metadata: Metadata = {
  title: { absolute: "Tshaeno: email signatures for your whole organisation" },
  description: "One consistent signature for everyone, in Gmail and Outlook, on every device. Kept up to date from your directory. Free for up to 15 people.",
};

// Previews use the live address for social icons, so render per request.
export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: RefreshCw, title: "Always up to date", text: "Names, titles and phone numbers come from Google Workspace or Microsoft 365. Someone changes role and their signature follows." },
  { icon: LayoutTemplate, title: "A studio, not a code editor", text: "Build from blocks or paste your designer's HTML. Every change is checked against Outlook, Gmail and Apple Mail, light and dark." },
  { icon: Building2, title: "The right signature for each team", text: "Different signatures by department, office or group, for new emails and replies, inside or outside the company." },
  { icon: Megaphone, title: "Campaign banners", text: "Schedule a banner for an event or offer, choose who carries it, and see how many people clicked." },
  { icon: BarChart3, title: "Know it worked", text: "A health score and plain tips for small teams, with detailed reports by department once you grow." },
  { icon: Sparkles, title: "Claude drafts it with you", text: "Describe the signature you want and Claude drafts it in your brand, then checks your templates for consistency." },
  { icon: UserRound, title: "People add their own touch", text: "Everyone can add a photo and their own social links, inside the design you set." },
  { icon: ShieldCheck, title: "Built for business email", text: "Two-step sign-in, a full audit trail, and every organisation's data kept apart in the database itself." },
] as const;

const STEPS = [
  { title: "Connect your directory", text: "Sign in with Google Workspace or Microsoft 365, or upload a spreadsheet. Your people appear with their details filled in." },
  { title: "Pick a template", text: "Choose from templates for your industry. They take on your logo and colours straight away." },
  { title: "It goes out everywhere", text: "Gmail is set for everyone automatically. Outlook gets it through an add-in your admin deploys once." },
] as const;

export default function Home() {
  const hero = starter("legal-counsel") ?? STARTERS[0];
  const teal = palette("teal");
  const heroHtml = sampleHtml(hero.doc, teal);
  const picks = ["general-personal", "finance-client-desk", "real-estate-agent"].map((k) => starter(k)).filter((s) => !!s);
  const colours = ["navy", "maroon", "forest"];

  return (
    <>
      <Section className="pt-12 sm:pt-20" inner="grid items-center gap-12 lg:grid-cols-[1fr_520px]">
        <div className="flex flex-col gap-6">
          <h1 className="text-[40px] leading-[44px] font-bold tracking-[-0.03em] text-ink text-balance sm:text-[56px] sm:leading-[60px]">
            Every email your team sends, signed properly<span className="text-accent">.</span>
          </h1>
          <p className="max-w-[560px] text-[17px] leading-7 text-ink-muted sm:text-[19px] sm:leading-8">
            Tshaeno sets one consistent signature for everyone in your organisation, in Gmail and Outlook, on every device. It stays up to date from your directory,
            from 2 people to 10,000.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/templates">See the templates</Link>
            </Button>
          </div>
          <ul className="flex flex-col gap-2 text-callout text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
            {[`Free for up to ${FREE_PEOPLE} people`, `${TRIAL_DAYS} days of everything to start`, "No card needed"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check aria-hidden className="size-4 text-positive" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <EmailMock
          html={heroHtml}
          title="An example signature from Tshaeno"
          to="Thato Sebina"
          subject="Re: Lease agreement, final version"
          body={["Hi Thato,", "The final version is attached with the changes we agreed on Tuesday. Let me know if anything needs another look."]}
        />
      </Section>

      <section aria-label="Works with" className="border-y border-border bg-surface-1 px-4 py-6 sm:px-6">
        <p className="mx-auto max-w-[1120px] text-center text-callout text-ink-muted">
          Works with <strong className="text-ink">Gmail and Google Workspace</strong> and <strong className="text-ink">Outlook and Microsoft 365</strong>, on Windows,
          Mac, the web, iPhone and Android.
        </p>
      </section>

      <Section aria-labelledby="how">
        <SectionTitle id="how" eyebrow="How it works" title="Live in under 20 minutes">
          Most small teams finish in under 20 minutes, and there is nothing to install on each computer.
        </SectionTitle>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-6">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-headline text-link">
                {i + 1}
              </span>
              <h3 className="text-headline text-ink">{s.title}</h3>
              <p className="text-body text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section aria-labelledby="features" className="bg-surface-1">
        <SectionTitle id="features" eyebrow="What you get" title="Everything a signature needs, and nothing it doesn't" />
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex flex-col gap-2">
              <f.icon aria-hidden className="size-6 text-link" />
              <h3 className="text-headline text-ink">{f.title}</h3>
              <p className="text-callout text-ink-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="templates">
        <SectionTitle id="templates" eyebrow="Templates" title={`${STARTERS.length} templates, made for real industries`}>
          From law firms to mines, each one takes on your logo and colours the moment you open it.
        </SectionTitle>
        <ul className="grid gap-6 md:grid-cols-3">
          {picks.map((s, i) => (
            <li key={s.key}>
              <Link href={`/templates/${s.key}`} className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 hover:border-border-strong">
                <SignatureThumb html={sampleHtml(s.doc, palette(colours[i]))} title={s.name} />
                <span className="flex flex-col">
                  <span className="font-semibold text-ink group-hover:underline">{s.name}</span>
                  <span className="text-callout text-ink-muted">{s.industry}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/templates" className="mt-6 inline-block font-semibold text-link hover:underline">
          Browse all {STARTERS.length} templates
        </Link>
      </Section>

      <Section aria-labelledby="native" className="bg-surface-1" inner="grid gap-10 lg:grid-cols-2">
        <div>
          <SectionTitle id="native" eyebrow="Why not the built-in signature?" title="Gmail and Outlook leave it to each person">
            So every signature is a little different, some are out of date, and nobody knows who has the new logo.
          </SectionTitle>
          <Button asChild variant="secondary">
            <Link href="/compare">Compare them side by side</Link>
          </Button>
        </div>
        <ul className="flex flex-col gap-4 self-center">
          {[
            ["Set once, for everyone", "Not 40 people copying and pasting from an email."],
            ["Changes reach everyone the same day", "A new phone number or logo goes out without asking anyone."],
            ["You can see who has it", "Coverage shows every person, and whether their signature is in place."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <Check aria-hidden className="mt-1 size-5 shrink-0 text-positive" />
              <span>
                <span className="block font-semibold text-ink">{t}</span>
                <span className="text-body text-ink-muted">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="price" inner="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-6 sm:p-8">
          <h2 id="price" className="text-title-2 text-ink">
            Free for up to {FREE_PEOPLE} people
          </h2>
          <p className="text-body text-ink-muted">
            Small teams keep everything for free, with a small Signature by Tshaeno link. Paid plans remove it and are priced per person, in pula, rand or dollars.
          </p>
          <Link href="/pricing" className="font-semibold text-link hover:underline">
            See pricing
          </Link>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-6 sm:p-8">
          <h2 className="text-title-2 text-ink">Already with Fourth Generation?</h2>
          <p className="text-body text-ink-muted">
            Add Tshaeno from the Fourth Generation marketplace and it is set up for you, billed on the invoice you already get. Fourth Generation email customers get
            Starter free.
          </p>
          <Link href="/fourth-generation" className="font-semibold text-link hover:underline">
            Buying through Fourth Generation
          </Link>
        </div>
      </Section>

      <Section className="bg-mark-tile text-center" inner="flex flex-col items-center gap-6">
        <h2 className="max-w-[640px] text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-balance text-white sm:text-[36px] sm:leading-[42px]">
          Give everyone a signature they don&apos;t have to think about
        </h2>
        <Button asChild size="lg">
          <Link href="/sign-up">Start free</Link>
        </Button>
      </Section>
    </>
  );
}

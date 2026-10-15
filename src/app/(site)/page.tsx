import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AudienceTabs, type AudienceTab } from "@/components/site/audience-tabs";
import { EmailMock } from "@/components/site/email-mock";
import { Display, Eyebrow, Section, SectionTitle } from "@/components/site/section";
import { SignatureThumb } from "@/components/signatures/thumb";
import { Button } from "@/components/ui/button";
import { FREE_PEOPLE, TRIAL_DAYS } from "@/lib/billing/plans";
import { STARTERS, starter, type Starter } from "@/lib/signature/starters";
import { palette } from "@/lib/site/samples";
import { sampleHtml } from "@/server/site";

export const metadata: Metadata = {
  title: { absolute: "Tshaeno: email signatures for the whole organisation" },
  description: `One polished signature for everyone in Gmail and Outlook, filled in from your directory and kept up to date. Try it free for ${TRIAL_DAYS} days.`,
};

// Previews use the live address for social icons, so render per request.
export const dynamic = "force-dynamic";

const pick = (key: string): Starter => starter(key) ?? STARTERS[0];

const STEPS = [
  ["Start your trial", `Make an account with your work email. You get ${TRIAL_DAYS} days of every feature and we don't ask for a card.`],
  ["Connect your directory", "Sign in with Google Workspace or Microsoft 365 and your people come across with their titles, phone numbers and offices."],
  ["Choose a design", "Start from a template, upload your logo and graphics, or paste the HTML your designer already made."],
  ["Roll it out", "Gmail is updated for everyone from our side. Outlook gets an add-in your admin deploys once. Nobody copies and pastes anything."],
] as const;

const TRUST = [
  ["Your data stays yours", "Every organisation's records are kept apart by the database itself, not just by our code. One customer can never see another's people."],
  ["Two-step sign-in", "Everyone who manages signatures signs in with a password and a code, a passkey, or Google or Microsoft."],
  ["A record of every change", "Who changed a template, published it, or added a rule, and when. Kept in an audit log you can read."],
  ["Nothing to install", "No software on each computer and nothing in your mail flow. Signatures go in through Gmail's own settings and Outlook's add-in."],
] as const;

export default function Home() {
  const hero = pick("real-estate-agent");
  const audience: AudienceTab[] = [
    {
      key: "it",
      label: "For IT",
      title: "Set it up once, then stop hearing about signatures.",
      points: [
        "Connect Google Workspace or Microsoft 365 and everyone's details come across. New starters get a signature on their first day.",
        "Gmail signatures are set for the whole domain. Outlook picks them up through an add-in you deploy once from the admin centre.",
        "Rules by department, office or group decide who gets which signature, for new emails and for replies.",
      ],
      html: sampleHtml(pick("legal-counsel"), palette("midnight")),
      caption: "Counsel, for a law firm. Logo, fine rule, details filled in from the directory.",
    },
    {
      key: "marketing",
      label: "For marketing",
      title: "Your brand on every email, exactly as it was designed.",
      points: [
        "Logo, colours, fonts and social links live in one brand kit. Change the kit and every signature follows.",
        "Put a campaign graphic under every signature for a launch or an event, and take it down on the date you choose.",
        "See how many people clicked, by campaign and by department.",
      ],
      html: sampleHtml(pick("hospitality-guest-relations"), palette("forest")),
      caption: "Guest relations, for a lodge, with a seasonal graphic and a booking button.",
    },
    {
      key: "sales",
      label: "For sales",
      title: "Every reply becomes a way to book the next meeting.",
      points: [
        "Give each rep a button that opens their own calendar link, with their photo beside their name.",
        "Show a different signature to people outside the company than to your own colleagues.",
        "Point a graphic at this month's offer and see which teams are driving the clicks.",
      ],
      html: sampleHtml(pick("consulting-advisor"), palette("cobalt")),
      caption: "Advisor, with a photo and a button that books a call.",
    },
    {
      key: "people",
      label: "For HR and leadership",
      title: "Everyone looks like they belong to the same company.",
      points: [
        "Titles and phone numbers stay right because they come straight from your directory.",
        "Your legal disclaimer is the same on every email, and you change it in one place.",
        "People can add their own photo and LinkedIn link, inside the design you approved.",
      ],
      html: sampleHtml(pick("finance-client-desk"), palette("oxblood")),
      caption: "Client desk, for a wealth manager. The same design for every adviser.",
    },
  ];
  const showcase = [pick("real-estate-agency"), pick("creative-studio")];
  const showcaseColours = ["midnight", "oxblood"];

  return (
    <>
      <Section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28" inner="grid items-center gap-14 lg:grid-cols-[1fr_560px] lg:gap-16">
        <div className="flex flex-col gap-8">
          <Eyebrow>Email signatures for the whole organisation</Eyebrow>
          <Display as="h1" className="text-[46px] leading-[50px] sm:text-[68px] sm:leading-[70px]">
            Every email should look like it came from <em className="text-accent">the same company.</em>
          </Display>
          <p className="max-w-[540px] text-[18px] leading-[30px] text-ink-muted sm:text-[19px]">
            Tshaeno gives everyone in your organisation the same polished signature in Gmail and Outlook. It fills in each person&apos;s details from your directory
            and keeps them right when people change roles, numbers or offices.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="px-7">
              <Link href="/sign-up">Start your {TRIAL_DAYS}-day trial</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="px-7">
              <Link href="/demo">Book a demo</Link>
            </Button>
          </div>
          <p className="text-[14px] text-ink-muted">No card needed. Teams of up to {FREE_PEOPLE} can stay on the free plan afterwards.</p>
        </div>
        <div className="relative">
          <div aria-hidden className="absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-br from-brand-soft via-surface-2 to-transparent sm:-inset-10" />
          <EmailMock
            html={sampleHtml(hero, palette("midnight"))}
            title="An example signature made with Tshaeno"
            from="Boitumelo Dube, Phakalane Properties"
            to="Thato Sebina"
            subject="Viewing on Saturday"
            body={["Hi Thato,", "Saturday at ten works well. I'll meet you at the gate and bring the floor plans and the levy statement you asked about."]}
          />
        </div>
      </Section>

      <section aria-label="Works with" className="border-y border-border bg-surface-1 px-4 py-7 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-ink-muted uppercase">Works with what you already use</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-display text-[22px] text-ink/80">
            <li>Google Workspace</li>
            <li>Microsoft 365</li>
            <li>Outlook</li>
            <li>Gmail</li>
            <li>Apple Mail</li>
          </ul>
        </div>
      </section>

      <Section id="product" aria-labelledby="who" className="scroll-mt-16">
        <SectionTitle id="who" eyebrow="Who it's for" title="One tool, and every team gets what it needs from it.">
          IT wants it to run without them. Marketing wants it on brand. Sales wants it to bring in meetings. Here is what each of them gets.
        </SectionTitle>
        <AudienceTabs tabs={audience} />
      </Section>

      <Section aria-labelledby="own" className="bg-surface-1" inner="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="order-2 grid gap-4 lg:order-1">
          {showcase.map((s, i) => (
            <Link
              key={s.key}
              href={`/templates/${s.key}?colour=${showcaseColours[i]}`}
              className={`group block rounded-xl border border-border bg-surface-0 p-3 transition-colors hover:border-border-strong ${i === 1 ? "lg:ml-16 lg:-mt-24" : "lg:mr-16"}`}
            >
              <SignatureThumb html={sampleHtml(s, palette(showcaseColours[i]))} title={s.name} />
            </Link>
          ))}
        </div>
        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <Eyebrow>Your design, not ours</Eyebrow>
          <Display id="own">Your logo. Your graphics. Your look.</Display>
          <p className="text-[18px] leading-[30px] text-ink-muted">
            Templates are a starting point, not a uniform. Upload your logo once and every design picks it up. Add your own banners, award badges or event posters
            under any signature. Move things around in the studio, or paste the HTML your designer already made and we&apos;ll check it works in Outlook, Gmail and
            Apple Mail.
          </p>
          <ul className="grid gap-x-8 gap-y-3 text-[15px] text-ink sm:grid-cols-2">
            {[`${STARTERS.length} templates across 16 industries`, "Your logo, photos and graphics", "A drag and drop studio", "Your own HTML, checked for you"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span aria-hidden className="h-px w-4 bg-accent" />
                {t}
              </li>
            ))}
          </ul>
          <div>
            <Button asChild variant="secondary" size="lg">
              <Link href="/templates">
                Try a template with your logo <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section aria-labelledby="steps">
        <SectionTitle id="steps" eyebrow="Getting started" title="Live across the company in an afternoon.">
          Most small teams have their first signature in place within twenty minutes of signing up. Nothing gets installed on anyone&apos;s computer.
        </SectionTitle>
        <ol className="grid border-t border-border md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-3 border-b border-border py-8 md:pr-8 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0">
              <span className="font-display text-[44px] leading-none text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-[18px] leading-7 font-semibold text-ink">{title}</h3>
              <p className="text-[15px] leading-6 text-ink-muted">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Start your free trial</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/demo">
              Or let us walk you through it <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </Section>

      <Section aria-labelledby="trust" className="bg-[#14213D] text-white" inner="grid gap-14 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div className="flex flex-col gap-6">
          <p className="flex items-center gap-3 text-[12px] leading-4 font-semibold tracking-[0.16em] text-white/60 uppercase">
            <span aria-hidden className="h-px w-8 bg-[#E3C893]" />
            Security
          </p>
          <h2 id="trust" className="font-display text-[40px] leading-[44px] text-balance sm:text-[54px] sm:leading-[58px]">
            Built for the way businesses handle email.
          </h2>
          <p className="text-[18px] leading-[30px] text-white/70">
            A signature tool sees your staff list and touches every email you send. We built Tshaeno knowing that.
          </p>
        </div>
        <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {TRUST.map(([title, text]) => (
            <div key={title} className="flex flex-col gap-2 border-t border-white/15 pt-6">
              <dt className="text-[18px] leading-7 font-semibold">{title}</dt>
              <dd className="text-[15px] leading-6 text-white/70">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section aria-labelledby="native" inner="grid gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-6">
          <Eyebrow>Why not the built-in signature?</Eyebrow>
          <Display id="native">Gmail and Outlook leave it to each person.</Display>
          <p className="text-[18px] leading-[30px] text-ink-muted">
            So forty people end up with forty slightly different signatures. Some still have last year&apos;s logo, a few have the wrong number, and nobody can say
            who&apos;s been updated.
          </p>
          <div>
            <Button asChild variant="secondary">
              <Link href="/compare">See them side by side</Link>
            </Button>
          </div>
        </div>
        <dl className="flex flex-col self-center border-t border-border">
          {[
            ["Set once, for everyone", "Instead of a how-to email and a hope that people follow it."],
            ["Changes go out the same day", "A new logo or office number reaches everyone without asking anyone to do anything."],
            ["You can see who has it", "A coverage page lists every person and whether their signature is in place."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 border-b border-border py-6">
              <dt className="text-[18px] leading-7 font-semibold text-ink">{t}</dt>
              <dd className="text-[15px] leading-6 text-ink-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section aria-labelledby="buy" className="bg-surface-1 pt-0 sm:pt-0" inner="grid gap-6 pt-20 sm:pt-28 md:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-0 p-8 sm:p-10">
          <h2 id="buy" className="font-display text-[34px] leading-[40px] text-ink">
            Free for teams of up to {FREE_PEOPLE}
          </h2>
          <p className="text-[16px] leading-7 text-ink-muted">
            Small teams keep every feature at no cost, with a small &quot;Signature by Tshaeno&quot; line. Paid plans remove it and are priced per person, in pula, rand
            or US dollars.
          </p>
          <Link href="/pricing" className="mt-auto inline-flex items-center gap-2 font-semibold text-link hover:underline">
            See pricing <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-0 p-8 sm:p-10">
          <h2 className="font-display text-[34px] leading-[40px] text-ink">Already with Fourth Generation?</h2>
          <p className="text-[16px] leading-7 text-ink-muted">
            Add Tshaeno from the Fourth Generation marketplace. We set it up for you and it appears on the invoice you already get. Fourth Generation email customers
            get the Starter plan free.
          </p>
          <Link href="/fourth-generation" className="mt-auto inline-flex items-center gap-2 font-semibold text-link hover:underline">
            How buying through Fourth Generation works <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </Section>

      <Section className="border-t border-border" inner="flex flex-col items-center gap-8 text-center">
        <Display className="max-w-[760px]">See your own logo on it before you decide anything.</Display>
        <p className="max-w-[560px] text-[18px] leading-[30px] text-ink-muted">
          Start a trial and have a signature ready in minutes, or book half an hour with us and we&apos;ll set it up with you.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="px-7">
            <Link href="/sign-up">Start your {TRIAL_DAYS}-day trial</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="px-7">
            <Link href="/demo">Book a demo</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}

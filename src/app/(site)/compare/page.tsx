import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { FREE_PEOPLE } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Tshaeno or the built-in Gmail and Outlook signature",
  description: "What changes when signatures are managed in one place, compared with each person setting their own in Gmail or Outlook.",
};

type Row = { topic: string; tshaeno: string; native: string; nativeOk?: boolean };

const ROWS: Row[] = [
  {
    topic: "Who sets it up",
    tshaeno: "You set it once, for everyone, from one place.",
    native: "Each person sets their own, on each computer and phone they use.",
  },
  {
    topic: "Keeping details current",
    tshaeno: "Names, titles and phones come from Google Workspace or Microsoft 365, so changes follow on their own.",
    native: "People have to remember to edit their signature when anything changes.",
  },
  {
    topic: "Looking the same everywhere",
    tshaeno: "Every template is checked in Outlook, Gmail and Apple Mail, on phones and in dark mode.",
    native: "Copied signatures often break: images go missing, fonts change, layouts fall apart on phones.",
  },
  {
    topic: "Different teams, different signatures",
    tshaeno: "Rules by department, office or group, and a shorter one for replies if you like.",
    native: "Not possible centrally.",
  },
  {
    topic: "Admin footers",
    tshaeno: "The full signature sits where people expect it, under their own message, and they see it as they write.",
    native:
      "Gmail can add the same plain footer to everyone's mail. Microsoft 365 can add a disclaimer, but it lands at the bottom of the thread and nobody sees it while writing.",
  },
  {
    topic: "Campaign banners",
    tshaeno: "Scheduled banners for chosen teams, with a count of clicks.",
    native: "Only if everyone pastes the banner in, and takes it out again on time.",
  },
  {
    topic: "Knowing it worked",
    tshaeno: "Coverage shows every person and whether their signature is in place.",
    native: "No way to tell without asking people for screenshots.",
  },
  {
    topic: "Personal touches",
    tshaeno: "People add their photo and social links, inside the design you set.",
    native: "Anyone can change anything, including the logo.",
  },
  {
    topic: "Cost",
    tshaeno: `Free for up to ${FREE_PEOPLE} people, then per person.`,
    native: "Included with Gmail and Outlook.",
    nativeOk: true,
  },
];

export default function ComparePage() {
  return (
    <>
      <Section className="pt-10 sm:pt-16">
        <div className="mb-10 flex max-w-[720px] flex-col gap-3">
          <h1 className="text-[34px] leading-[40px] font-bold tracking-[-0.03em] text-ink text-balance sm:text-[44px] sm:leading-[50px]">
            Tshaeno or the built-in signature
          </h1>
          <p className="text-[17px] leading-7 text-ink-muted">
            Gmail and Outlook both let each person write a signature. That works for one person. For a team, it means every signature is a little different and
            nobody owns keeping them right.
          </p>
        </div>

        {/* A table on wide screens; on phones each row becomes a card. */}
        <table className="w-full border-collapse text-left max-md:block">
          <thead className="max-md:sr-only">
            <tr className="border-b border-border-strong">
              <th scope="col" className="w-[22%] py-3 pr-6 text-callout font-semibold text-ink-muted">
                <span className="sr-only">Topic</span>
              </th>
              <th scope="col" className="w-[39%] py-3 pr-6 text-headline text-ink">
                Tshaeno
              </th>
              <th scope="col" className="py-3 text-headline text-ink">
                Built-in Gmail and Outlook
              </th>
            </tr>
          </thead>
          <tbody className="max-md:flex max-md:flex-col max-md:gap-4">
            {ROWS.map((r) => (
              <tr key={r.topic} className="border-b border-border align-top max-md:flex max-md:flex-col max-md:gap-3 max-md:rounded-lg max-md:border max-md:bg-surface-1 max-md:p-5">
                <th scope="row" className="py-5 pr-6 text-headline text-ink max-md:p-0">
                  {r.topic}
                </th>
                <td className="py-5 pr-6 max-md:p-0">
                  <span className="flex gap-3 text-body text-ink">
                    <Check aria-hidden className="mt-1 size-4 shrink-0 text-positive" />
                    <span>
                      <span className="font-semibold md:sr-only">Tshaeno: </span>
                      {r.tshaeno}
                    </span>
                  </span>
                </td>
                <td className="py-5 max-md:p-0">
                  <span className="flex gap-3 text-body text-ink-muted">
                    {r.nativeOk ? <Check aria-hidden className="mt-1 size-4 shrink-0 text-positive" /> : <Minus aria-hidden className="mt-1 size-4 shrink-0 text-border-strong" />}
                    <span>
                      <span className="font-semibold text-ink md:sr-only">Built in: </span>
                      {r.native}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section className="bg-surface-1" inner="flex flex-col items-start gap-4">
        <h2 className="text-title-2 text-ink">Already have signatures people like?</h2>
        <p className="max-w-[640px] text-body text-ink-muted">
          Paste one into the studio as HTML and we turn it into a signature for everyone, with each person&apos;s details filled in.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Start free</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/templates">See the templates</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}

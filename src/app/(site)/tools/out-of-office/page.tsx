import type { Metadata } from "next";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { AwayWriter } from "./away-writer";

export const metadata: Metadata = {
  title: "Free out-of-office message writer",
  description: "Write a clear out-of-office reply in a friendly or formal tone, with who to contact while you're away. Free, and nothing you type is stored.",
};

export default function OutOfOfficePage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mb-10 flex max-w-[760px] flex-col gap-5">
        <Eyebrow>Free tool</Eyebrow>
        <Display as="h1">An out-of-office reply people can act on.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">
          The good ones say three things: when you&apos;re back, who can help in the meantime, and what to do if it can&apos;t wait. Fill in the form and copy the result.
        </p>
      </div>
      <AwayWriter />
    </Section>
  );
}

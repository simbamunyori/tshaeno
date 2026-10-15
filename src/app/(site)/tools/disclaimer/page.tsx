import type { Metadata } from "next";
import Link from "next/link";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { DisclaimerWriter } from "./disclaimer-writer";

export const metadata: Metadata = {
  title: "Free email disclaimer writer",
  description: "Write a short, plain email disclaimer for a business in Botswana, South Africa or elsewhere. Pick the parts you need and copy it.",
};

export default function DisclaimerPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mb-10 flex max-w-[760px] flex-col gap-5">
        <Eyebrow>Free tool</Eyebrow>
        <Display as="h1">An email disclaimer short enough to be read.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">
          Most disclaimers run to a paragraph nobody reads. Pick only the parts your business needs and you&apos;ll get two or three plain sentences. Our{" "}
          <Link href="/guides/email-disclaimers" className="font-semibold text-link hover:underline">
            guide to email disclaimers
          </Link>{" "}
          explains what each part does.
        </p>
      </div>
      <DisclaimerWriter />
    </Section>
  );
}

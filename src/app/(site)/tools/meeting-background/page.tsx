import type { Metadata } from "next";
import Link from "next/link";
import { Display, Eyebrow, Section } from "@/components/site/section";
import { BackgroundMaker } from "./background-maker";

export const metadata: Metadata = {
  title: "Free branded meeting background maker",
  description: "Make a branded background for Zoom, Microsoft Teams and Google Meet with your logo, name and title. Free, and nothing is uploaded.",
};

export default function MeetingBackgroundPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mb-10 flex max-w-[760px] flex-col gap-5">
        <Eyebrow>Free tool</Eyebrow>
        <Display as="h1">A meeting background with your logo, in a minute.</Display>
        <p className="text-[18px] leading-[30px] text-ink-muted">
          For Zoom, Microsoft Teams and Google Meet. Add your logo, name and title, pick a style, and download a full HD image. Our{" "}
          <Link href="/guides/branded-meeting-backgrounds" className="font-semibold text-link hover:underline">
            guide to meeting backgrounds
          </Link>{" "}
          explains how to set it in each app.
        </p>
      </div>
      <BackgroundMaker />
    </Section>
  );
}

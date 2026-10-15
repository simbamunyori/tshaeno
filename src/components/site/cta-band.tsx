import Link from "next/link";
import { Button } from "@/components/ui/button";

/** The closing call to action used at the foot of the website's inner pages. */
export function CtaBand({ title = "See it with your own logo.", text = "Start a 14-day trial with every feature, or book half an hour with us and we'll set it up with you." }: { title?: string; text?: string }) {
  return (
    <div className="mt-20 flex flex-col items-start gap-6 rounded-xl bg-brand p-8 text-on-brand sm:p-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex max-w-[640px] flex-col gap-2">
        <h2 className="font-display text-[32px] leading-[38px]">{title}</h2>
        <p className="text-[16px] leading-7 opacity-80">{text}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <Button asChild size="lg" variant="secondary" className="border-transparent">
          <Link href="/sign-up">Start your 14-day trial</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className="border border-white/30 text-on-brand hover:bg-white/10 hover:text-on-brand">
          <Link href="/demo">Book a demo</Link>
        </Button>
      </div>
    </div>
  );
}

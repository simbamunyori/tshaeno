import { Check } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Wordmark } from "@/components/ui/logo";

export const AUTH_POINTS: [string, string][] = [
  ["One signature for everyone", "Set it once. Each person's name, title and number fill in from your directory."],
  ["Gmail and Outlook", "On the web, on desktops and on phones. Nothing goes in your mail flow."],
  ["Your data stays yours", "Every organisation's records are kept apart by the database itself."],
];

export interface AuthShellProps {
  title?: string;
  points?: [string, string][];
  children: React.ReactNode;
}

/**
 * The split screen used by sign-up, sign-in and the second step: a midnight
 * brand panel on wide screens and the form beside it. On a phone the
 * form comes first, with the mark above it.
 */
export function AuthShell({ title = "Good to see you.", points = AUTH_POINTS, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh">
      <aside className="relative hidden w-[500px] shrink-0 flex-col overflow-hidden bg-[#14213D] px-14 py-12 text-white lg:flex xl:w-[540px]">
        <Link href="/" className="relative flex items-center gap-2.5 self-start rounded-sm">
          <Wordmark height={38} />
        </Link>
        <div className="relative mt-auto flex flex-col gap-8">
          <h2 className="font-display text-[52px] leading-[56px] tracking-[-0.01em] text-balance">{title}</h2>
          <ul className="flex flex-col gap-5">
            {points.map(([head, body]) => (
              <li key={head} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E3C893]/15 text-[#E3C893]">
                  <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="flex flex-col">
                  <span className="text-[16px] leading-6 font-semibold">{head}</span>
                  <span className="text-[14px] leading-5 text-white/75">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-callout text-white/60">Also available through Fourth Generation Technologies.</p>
        <Wordmark height={220} title="" className="pointer-events-none absolute -top-6 -right-40 text-[#E3C893] opacity-[0.07]" />
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-12">
        <Link href="/" className="mb-10 flex items-center gap-2.5 self-center lg:hidden">
          <Wordmark height={38} className="text-ink" />
        </Link>
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow ? <span className="text-caption font-semibold tracking-wide text-ink-muted uppercase">{eyebrow}</span> : null}
      <h1 className="font-display text-[34px] leading-10 font-normal text-ink">{title}</h1>
      {children ? <p className="text-body text-ink-muted">{children}</p> : null}
    </div>
  );
}

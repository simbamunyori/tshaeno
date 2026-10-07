import { Check } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { LogoMark } from "@/components/ui/logo";

export const AUTH_POINTS: [string, string][] = [
  ["One signature for everyone", "Every person's signature, set centrally and kept up to date."],
  ["Works in Gmail and Outlook", "On the web, desktop and phone, without touching your mail flow."],
  ["Your data stays yours", "Each organisation is sealed off from every other, in the database itself."],
];

export interface AuthShellProps {
  title?: string;
  points?: [string, string][];
  children: React.ReactNode;
}

/**
 * The split screen used by sign-up, sign-in and the second step: a navy
 * brand panel on wide screens and the form beside it. On a phone the
 * form comes first, with the mark above it.
 */
export function AuthShell({ title = "Every email, signed properly.", points = AUTH_POINTS, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh">
      <aside className="relative hidden w-[500px] shrink-0 flex-col overflow-hidden bg-[#0B1F3A] px-14 py-12 text-white lg:flex xl:w-[540px]">
        <Link href="/" className="relative flex items-center gap-2.5 self-start rounded-sm">
          <LogoMark size={30} title="" tile="#16335C" />
          <span className="text-[20px] leading-none font-bold tracking-[-0.03em]">tshaeno</span>
        </Link>
        <div className="relative mt-auto flex flex-col gap-8">
          <h2 className="text-display text-balance">{title}</h2>
          <ul className="flex flex-col gap-5">
            {points.map(([head, body]) => (
              <li key={head} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2EC4B6]/20 text-[#2EC4B6]">
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
        <svg aria-hidden viewBox="0 0 48 48" className="pointer-events-none absolute -top-20 -right-28 size-[380px] opacity-[0.07]">
          <g fill="none" strokeWidth="6" strokeLinecap="round" stroke="#2EC4B6">
            <path d="M20 14v12a8 8 0 0 0 8 8" />
            <path d="M10 14h20" />
          </g>
        </svg>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-12">
        <Link href="/" className="mb-10 flex items-center gap-2.5 self-center lg:hidden">
          <LogoMark size={30} title="" />
          <span className="text-[20px] leading-none font-bold tracking-[-0.03em] text-ink">tshaeno</span>
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
      <h1 className="text-title-1 text-ink">{title}</h1>
      {children ? <p className="text-body text-ink-muted">{children}</p> : null}
    </div>
  );
}

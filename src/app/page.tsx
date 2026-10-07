import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

/** A holding page until the website arrives in milestone S7. */
export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/sign-in" className="text-body font-semibold text-link hover:underline">
          Sign in
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-[40px] leading-[44px] font-bold tracking-[-0.03em] text-ink text-balance sm:text-[56px] sm:leading-[60px]">
          Every email your team sends, signed properly<span className="text-accent">.</span>
        </h1>
        <p className="max-w-[560px] text-[17px] leading-7 text-ink-muted">
          Tshaeno sets one consistent signature for everyone in your organisation, in Gmail and Outlook, on every device. From 2
          people to 10,000.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Start free</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </main>
      <footer className="text-callout text-ink-muted">Also available through Fourth Generation Technologies.</footer>
    </div>
  );
}

import { Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { TRIAL_DAYS } from "@/lib/billing/plans";

export const SITE_NAV = [
  { href: "/#product", label: "Product" },
  { href: "/templates", label: "Templates" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/fourth-generation", label: "Fourth Generation" },
] as const;

/** The website's top bar. On phones the links fold into a menu that needs no script. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-surface-0/90 backdrop-blur supports-[backdrop-filter]:bg-surface-0/80">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Link href="/" aria-label="Tshaeno home" className="shrink-0 rounded-sm">
          <Logo size={30} />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {SITE_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/sign-in" className="hidden rounded-md px-3 py-2 text-[14px] font-medium text-ink hover:bg-surface-2 sm:block">
            Sign in
          </Link>
          <Button asChild size="sm" variant="secondary" className="hidden h-9 px-4 text-[14px] sm:inline-flex">
            <Link href="/demo">Book a demo</Link>
          </Button>
          <Button asChild size="sm" className="h-9 px-4 text-[14px]">
            <Link href="/sign-up" title={`${TRIAL_DAYS} days of every feature, no card needed`}>
              Start free trial
            </Link>
          </Button>
          <details className="group relative lg:hidden">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden className="size-5" />
              <span className="sr-only">Menu</span>
            </summary>
            <nav aria-label="Main" className="absolute right-0 mt-2 flex w-60 flex-col rounded-lg border border-border bg-surface-1 p-2 shadow-elevation-3">
              {SITE_NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-2.5 text-body text-ink hover:bg-surface-2">
                  {n.label}
                </Link>
              ))}
              <Link href="/demo" className="rounded-md px-3 py-2.5 text-body text-ink hover:bg-surface-2">
                Book a demo
              </Link>
              <Link href="/sign-in" className="rounded-md px-3 py-2.5 text-body text-ink hover:bg-surface-2">
                Sign in
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

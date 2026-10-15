import { Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { INDUSTRY_LINKS, PRODUCT, RESOURCES, TEAMS } from "@/lib/site/nav";
import { MegaMenu } from "./mega-menu";

/** The website's top bar. On phones the links fold into a menu that needs no script. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-surface-0/90 backdrop-blur supports-[backdrop-filter]:bg-surface-0/80">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Link href="/" aria-label="Tshaeno home" className="shrink-0 rounded-sm">
          <Logo size={30} />
        </Link>
        <MegaMenu />
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
          <details className="group lg:hidden">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden className="size-5" />
              <span className="sr-only">Menu</span>
            </summary>
            <nav aria-label="Main" className="absolute inset-x-0 top-full flex h-[calc(100dvh-72px)] flex-col gap-6 overflow-y-auto border-t border-border bg-surface-1 px-4 py-6 sm:px-6">
              {[
                ["Product", PRODUCT],
                ["Solutions by team", TEAMS],
                ["Solutions by industry", INDUSTRY_LINKS],
                ["Resources", RESOURCES],
              ].map(([title, links]) => (
                <div key={title as string} className="flex flex-col">
                  <p className="pb-2 text-[12px] font-semibold tracking-[0.14em] text-ink-muted uppercase">{title as string}</p>
                  <div className={(links as typeof PRODUCT).length > 8 ? "grid grid-cols-2" : "flex flex-col"}>
                    {(links as typeof PRODUCT).map((n) => (
                      <Link key={n.href} href={n.href} className="py-2 text-body text-ink">
                        {n.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-col border-t border-border pt-4">
                <Link href="/pricing" className="py-2 text-body font-semibold text-ink">
                  Pricing
                </Link>
                <Link href="/fourth-generation" className="py-2 text-body font-semibold text-ink">
                  Fourth Generation
                </Link>
                <Link href="/sign-in" className="py-2 text-body font-semibold text-ink">
                  Sign in
                </Link>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

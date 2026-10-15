import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo size={26} />
          <p className="text-callout text-ink-muted">Email signatures for everyone in your organisation, set in one place and kept up to date.</p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2 text-callout">
          <p className="font-semibold text-ink">Product</p>
          <Link href="/" className="text-ink-muted hover:text-ink">
            How it works
          </Link>
          <Link href="/templates" className="text-ink-muted hover:text-ink">
            Templates
          </Link>
          <Link href="/pricing" className="text-ink-muted hover:text-ink">
            Pricing
          </Link>
          <Link href="/compare" className="text-ink-muted hover:text-ink">
            Tshaeno or built-in signatures
          </Link>
        </nav>
        <nav aria-label="Account" className="flex flex-col gap-2 text-callout">
          <p className="font-semibold text-ink">Your account</p>
          <Link href="/sign-up" className="text-ink-muted hover:text-ink">
            Start free
          </Link>
          <Link href="/sign-in" className="text-ink-muted hover:text-ink">
            Sign in
          </Link>
          <Link href="/me" className="text-ink-muted hover:text-ink">
            Change your own photo and links
          </Link>
        </nav>
        <div className="flex flex-col gap-2 text-callout">
          <p className="font-semibold text-ink">Buying through Fourth Generation</p>
          <p className="text-ink-muted">
            Tshaeno is also sold by Fourth Generation Technologies, on the same invoice as your other services.{" "}
            <Link href="/fourth-generation" className="font-semibold text-link hover:underline">
              How it works
            </Link>
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[1120px] px-4 pb-8 text-caption text-ink-muted sm:px-6">© {new Date().getFullYear()} Tshaeno</div>
    </footer>
  );
}

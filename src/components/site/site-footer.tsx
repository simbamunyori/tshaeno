import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { PRODUCT, RESOURCES, TEAMS } from "@/lib/site/nav";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [...PRODUCT.map((l): [string, string] => [l.label, l.href]), ["Pricing", "/pricing"]] },
  { title: "Solutions", links: [...TEAMS.map((l): [string, string] => [l.label, l.href]), ["By industry", "/solutions"]] },
  { title: "Resources", links: RESOURCES.map((l): [string, string] => [l.label, l.href]) },
  {
    title: "Company",
    links: [
      ["Fourth Generation customers", "/fourth-generation"],
      ["Start a free trial", "/sign-up"],
      ["Sign in", "/sign-in"],
      ["Update your own photo and links", "/me"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#0E1424] text-white">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 pt-20 pb-12 sm:px-6 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-5">
          <Wordmark height={44} className="text-[#E3C893]" />
          <p className="max-w-[320px] text-[14px] leading-6 text-white/65">
            Email signatures for organisations that care how they come across. Set once, kept right, on every email.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-col gap-3 text-[14px]">
            <p className="mb-1 text-[12px] font-semibold tracking-[0.14em] text-white/50 uppercase">{c.title}</p>
            {c.links.map(([label, href]) => (
              <Link key={href} href={href} className="text-white/80 transition-colors hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="flex flex-col gap-2 border-t border-white/10 py-8 text-[13px] text-white/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Tshaeno. All rights reserved.</p>
          <p>Also sold by Fourth Generation Technologies, on the invoice you already get.</p>
        </div>
      </div>
    </footer>
  );
}

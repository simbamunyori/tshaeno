import Link from "next/link";
import { cn } from "@/lib/cn";

export function IndustryFilter({ industries, current }: { industries: string[]; current: string }) {
  const chip = (active: boolean) =>
    cn("inline-flex h-8 items-center rounded-full border px-3 text-callout", active ? "border-transparent bg-brand text-on-brand" : "border-border text-ink hover:bg-surface-2");
  return (
    <nav aria-label="Industry" className="flex flex-wrap gap-2">
      <Link href="/app/signatures/new" className={chip(!current)} aria-current={!current ? "page" : undefined}>
        All
      </Link>
      {industries.map((i) => (
        <Link key={i} href={`/app/signatures/new?industry=${encodeURIComponent(i)}`} className={chip(current === i)} aria-current={current === i ? "page" : undefined}>
          {i}
        </Link>
      ))}
    </nav>
  );
}

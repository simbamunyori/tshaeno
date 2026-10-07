import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { requireStaff } from "./staff";

export const metadata = { title: { default: "Platform admin", template: "%s · Platform admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 py-2 border-b border-border bg-surface-1 px-4 sm:px-8">
        <Link href="/admin" className="flex items-center gap-3 rounded-sm">
          <Logo size={26} />
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-caption font-semibold text-accent">Staff</span>
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-callout font-semibold">
          <Link href="/admin" className="text-link hover:underline">Organisations</Link>
          <Link href="/admin/prices" className="text-link hover:underline">Prices</Link>
          <Link href="/admin/log" className="text-link hover:underline">Staff log</Link>
          <Link href="/app" className="text-ink-muted hover:underline">Back to the app</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}

"use client";

import { Contact, LayoutGrid, Palette, PenLine, ScrollText, Settings, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const NAV = [
  { href: "/app", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/app/signatures", label: "Signatures", icon: PenLine },
  { href: "/app/brand", label: "Brand kits", icon: Palette },
  { href: "/app/people", label: "People", icon: Contact },
  { href: "/app/team", label: "Team", icon: UsersRound },
  { href: "/app/audit", label: "Audit log", icon: ScrollText },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: true },
  { href: "/app/settings/security", label: "Your security", icon: ShieldCheck },
];

/** `staff` adds the platform admin area for Tshaeno staff. */
export function SidebarNav({ onNavigate, staff }: { onNavigate?: () => void; staff?: boolean }) {
  const pathname = usePathname();
  const items = staff ? [...NAV, { href: "/admin", label: "Platform admin", icon: Wrench, exact: false }] : NAV;
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-body transition-colors",
              active ? "bg-brand-soft font-semibold text-link" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon aria-hidden className="size-[18px]" strokeWidth={active ? 2 : 1.75} />
            <span className="flex-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

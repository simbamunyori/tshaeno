"use client";

import { BarChart3, Contact, CreditCard, Rocket, Gauge, LayoutGrid, Lock, Megaphone, MonitorPlay, Palette, PenLine, Plane, Plug, ScrollText, Settings, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PREMIUM_NAV } from "@/lib/billing/features";
import { cn } from "@/lib/cn";

export const NAV = [
  { href: "/app", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/app/start", label: "Get started", icon: Rocket },
  { href: "/app/signatures", label: "Signatures", icon: PenLine },
  { href: "/app/brand", label: "Brand kits", icon: Palette },
  { href: "/app/people", label: "People", icon: Contact },
  { href: "/app/coverage", label: "Coverage", icon: Gauge },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/app/backgrounds", label: "Meeting backgrounds", icon: MonitorPlay },
  { href: "/app/away", label: "Out-of-office", icon: Plane },
  { href: "/app/analytics", label: "Reports", icon: BarChart3 },
  { href: "/app/connections", label: "Connections", icon: Plug },
  { href: "/app/team", label: "Team", icon: UsersRound },
  { href: "/app/billing", label: "Plan and billing", icon: CreditCard },
  { href: "/app/audit", label: "Audit log", icon: ScrollText },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: true },
  { href: "/app/settings/security", label: "Your security", icon: ShieldCheck },
];

/** `staff` adds the platform admin area for Tshaeno staff. `locked` marks premium pages on free signatures. */
export function SidebarNav({ onNavigate, staff, locked }: { onNavigate?: () => void; staff?: boolean; locked?: boolean }) {
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
            {locked && PREMIUM_NAV[href] ? <Lock aria-label="Full plan" className="size-3.5 text-ink-muted" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

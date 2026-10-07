import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { initials } from "@/lib/initials";

export { initials };

/** "Kalahari Freight & Logistics" gives "KF". */
export function orgInitials(name: string): string {
  const words = name.replace(/&/g, " ").trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function UserCard({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-border pt-4">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-callout font-semibold text-on-brand"
      >
        {initials(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-semibold text-ink">{name}</span>
        <span className="truncate text-caption text-ink-muted">{role}</span>
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut aria-hidden className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}

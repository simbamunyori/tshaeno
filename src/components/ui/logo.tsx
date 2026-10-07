import { cn } from "@/lib/cn";

/**
 * The Tshaeno mark: a "t" whose stem runs into a signature stroke, ending
 * in a Signal dot. Source: brand/logo/mark.svg. The tile follows the
 * theme; pass `tile` to force a colour on a fixed background.
 */
export function LogoMark({ size = 32, className, title = "Tshaeno", tile }: { size?: number; className?: string; title?: string; tile?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={title || undefined} aria-hidden={title ? undefined : true} className={cn("shrink-0", className)}>
      <rect width="48" height="48" rx="12" fill={tile ?? "var(--mark-tile)"} />
      <g fill="none" strokeWidth="6" strokeLinecap="round">
        <path d="M20 14v12a8 8 0 0 0 8 8" stroke="#FFFFFF" />
        <path d="M10 14h20" stroke="#2EC4B6" />
      </g>
      <circle cx="38" cy="34" r="3.5" fill="#FF5B2E" />
    </svg>
  );
}

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} title="" />
      <span className="text-[20px] leading-none font-bold tracking-[-0.03em] text-ink">tshaeno</span>
    </span>
  );
}

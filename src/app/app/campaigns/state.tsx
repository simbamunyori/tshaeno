import type { CampaignState } from "@/lib/signature/campaigns";
import { cn } from "@/lib/cn";

const LABEL: Record<CampaignState, string> = { scheduled: "Scheduled", running: "Running", paused: "Paused", ended: "Ended" };
const TONE: Record<CampaignState, string> = {
  scheduled: "bg-brand-soft text-link",
  running: "bg-positive-soft text-positive",
  paused: "bg-warning-soft text-warning",
  ended: "bg-surface-2 text-ink-muted",
};

export function StateChip({ state }: { state: CampaignState }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", TONE[state])}>{LABEL[state]}</span>;
}

/** Clicks per day as a row of bars, newest on the right. */
export function DailyBars({ daily, label }: { daily: number[]; label: string }) {
  const max = Math.max(1, ...daily);
  return (
    <div role="img" aria-label={label} className="flex h-16 items-end gap-[2px]">
      {daily.map((n, i) => (
        <span key={i} className={cn("min-w-0 flex-1 rounded-t-sm", n ? "bg-[var(--brand)]" : "bg-border")} style={{ height: `${Math.max(4, (n / max) * 100)}%` }} />
      ))}
    </div>
  );
}

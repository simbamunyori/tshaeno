"use client";

import { Check } from "lucide-react";
import { useId, useState } from "react";
import { SignatureThumb } from "@/components/signatures/thumb";
import { cn } from "@/lib/cn";

export interface AudienceTab {
  key: string;
  label: string;
  title: string;
  points: string[];
  html: string;
  caption: string;
}

/** One product, explained to each of the people who would buy it. */
export function AudienceTabs({ tabs }: { tabs: AudienceTab[] }) {
  const [active, setActive] = useState(tabs[0].key);
  const base = useId();
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div className="flex flex-col gap-10">
      <div role="tablist" aria-label="Who it's for" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`${base}-${t.key}`}
            aria-selected={t.key === active}
            aria-controls={`${base}-panel`}
            onClick={() => setActive(t.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-[15px] font-medium whitespace-nowrap transition-colors",
              t.key === active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab.key}`} className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="flex flex-col gap-6">
          <h3 className="font-display text-[34px] leading-[40px] text-balance text-ink">{tab.title}</h3>
          <ul className="flex flex-col gap-4">
            {tab.points.map((p) => (
              <li key={p} className="flex gap-3 text-[16px] leading-7 text-ink">
                <Check aria-hidden className="mt-1.5 size-4 shrink-0 text-accent" strokeWidth={2.5} />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <figure className="flex flex-col gap-3 rounded-xl border border-border bg-surface-0 p-4 sm:p-6">
          <SignatureThumb html={tab.html} title={tab.caption} />
          <figcaption className="px-1 text-[13px] text-ink-muted">{tab.caption}</figcaption>
        </figure>
      </div>
    </div>
  );
}

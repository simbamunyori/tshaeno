"use client";

import { useState } from "react";
import { CopyBox } from "@/components/site/copy-box";
import { cn } from "@/lib/cn";
import { AWAY_REASONS, type AwayInput, outOfOffice } from "@/lib/site/writers";

const field = "h-10 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-body text-ink placeholder:text-ink-muted/70";
const label = "flex flex-col gap-1.5 text-callout font-semibold text-ink";

/** Fills in an out-of-office reply as people type. Nothing is sent anywhere. */
export function AwayWriter() {
  const [v, setV] = useState<AwayInput>({
    name: "",
    reason: "leave",
    back: "",
    cover: "",
    coverEmail: "",
    urgent: "",
    company: "",
    tone: "warm",
  });
  const set = <K extends keyof AwayInput>(k: K, value: AwayInput[K]) => setV((o) => ({ ...o, [k]: value }));
  const text = outOfOffice({
    ...v,
    name: v.name || "Lesego Molefe",
    back: v.back || "Monday 3 November",
    company: v.company || "Northgate & Company",
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form className="flex flex-col gap-4 self-start rounded-lg border border-border bg-surface-1 p-5 sm:p-6" onSubmit={(e) => e.preventDefault()} aria-label="Your details">
        <label className={label}>
          Why you&apos;re away
          <select className={field} value={v.reason} onChange={(e) => set("reason", e.target.value as AwayInput["reason"])}>
            {AWAY_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Back on
          <input className={field} value={v.back} onChange={(e) => set("back", e.target.value)} placeholder="Monday 3 November" maxLength={40} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className={label}>
            Your name
            <input className={field} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Lesego Molefe" maxLength={60} autoComplete="name" />
          </label>
          <label className={label}>
            Company
            <input className={field} value={v.company} onChange={(e) => set("company", e.target.value)} placeholder="Northgate & Company" maxLength={60} autoComplete="organization" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className={label}>
            Who&apos;s covering for you
            <input className={field} value={v.cover} onChange={(e) => set("cover", e.target.value)} placeholder="Kagiso Sebina" maxLength={60} />
          </label>
          <label className={label}>
            Their email
            <input className={field} type="email" value={v.coverEmail} onChange={(e) => set("coverEmail", e.target.value)} placeholder="kagiso@northgate.co.bw" maxLength={80} />
          </label>
        </div>
        <label className={label}>
          Number for urgent matters
          <input className={field} value={v.urgent} onChange={(e) => set("urgent", e.target.value)} placeholder="+267 390 0000" maxLength={30} />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-callout font-semibold text-ink">Tone</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["warm", "formal"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={v.tone === t}
                onClick={() => set("tone", t)}
                className={cn(
                  "h-10 rounded-md border text-callout font-semibold",
                  v.tone === t ? "border-ink bg-ink text-surface-1" : "border-border-strong bg-surface-1 text-ink hover:border-ink",
                )}
              >
                {t === "warm" ? "Friendly" : "Formal"}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
      <div className="flex min-w-0 flex-col gap-4">
        <CopyBox text={text} label="Your out-of-office reply" />
        <p className="text-callout text-ink-muted">
          Paste it into Outlook under Automatic replies, or into Gmail under Settings, then Vacation responder. Grey text in the form is only an example and is used until you type your own.
        </p>
      </div>
    </div>
  );
}

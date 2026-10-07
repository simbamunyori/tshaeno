"use client";

import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { BrandFinding } from "@/lib/signature/brand-check";
import { brandReviewAction, type ReviewState } from "./actions";

export function FindingList({ findings }: { findings: BrandFinding[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {findings.map((f, i) => (
        <li key={i} className="flex gap-3 text-callout">
          {f.severity === "warning" ? <AlertTriangle aria-label="Fix" className="mt-0.5 size-4 shrink-0 text-warning" /> : <Info aria-label="Worth a look" className="mt-0.5 size-4 shrink-0 text-ink-muted" />}
          <span className="text-ink">
            {f.template ? <span className="font-semibold">{f.template}: </span> : null}
            {f.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Claude's second look, on request. Nothing is kept; ask again any time. */
export function ClaudeReview() {
  const [state, run, pending] = useActionState<ReviewState>(brandReviewAction, {});
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.findings ? (
        state.findings.length ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-callout font-semibold text-ink">Claude also noticed</h3>
            <FindingList findings={state.findings} />
          </div>
        ) : (
          <Alert tone="positive">Claude found nothing else to change.</Alert>
        )
      ) : null}
      <form action={run}>
        <Button type="submit" variant="secondary" disabled={pending}>
          <Sparkles aria-hidden />
          {pending ? "Claude is looking…" : state.findings ? "Ask Claude again" : "Ask Claude for a second look"}
        </Button>
      </form>
      <p className="text-caption text-ink-muted">Claude sees your published signatures and brand kits, never anyone&apos;s details.</p>
    </div>
  );
}

"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { SelectField } from "@/components/ui/inputs";
import { cn } from "@/lib/cn";
import { draftWithClaudeAction, type ActionResult } from "../actions";

/** Describe a signature in a sentence or two, and Claude drafts it in the chosen brand kit. */
export function DraftWithClaude({ kits }: { kits: { id: string; name: string }[] }) {
  const [state, run, pending] = useActionState<ActionResult, FormData>(draftWithClaudeAction, {});
  return (
    <form action={run} className="flex flex-col gap-4">
      {state.error && !state.fieldErrors ? <Alert>{state.error}</Alert> : null}
      <Field id="description" label="What should it look like?" error={state.fieldErrors?.description} hint="For example: our logo on the left, name in navy, title underneath, then phone and email in small grey text, and our LinkedIn.">
        {(describedBy, invalid) => (
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={1500}
            required
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "h-auto py-2")}
          />
        )}
      </Field>
      {kits.length > 1 ? <SelectField id="brandKitId" label="Brand kit" options={kits.map((k) => ({ value: k.id, label: k.name }))} /> : <input type="hidden" name="brandKitId" value={kits[0]?.id ?? ""} />}
      <Button type="submit" disabled={pending} className="self-start">
        <Sparkles aria-hidden />
        {pending ? "Claude is drafting it…" : "Draft it with Claude"}
      </Button>
      <p className="text-caption text-ink-muted">Claude sees your brand kit and what you write here, never anyone&apos;s details. You can change everything in the studio before publishing.</p>
    </form>
  );
}

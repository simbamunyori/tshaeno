"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { FormState } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AWAY_REASONS, outOfOffice, type AwayReason } from "@/lib/site/writers";
import { setAwayAction } from "./actions";

interface PersonOption {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const field = "h-10 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-body text-ink";
const label = "flex flex-col gap-1.5 text-callout font-semibold text-ink";

/** "Monday 3 November", from a datetime-local value. */
function dayName(local: string): string {
  const [d] = local.split("T");
  if (!d) return "";
  const at = new Date(`${d}T12:00:00Z`);
  return Number.isNaN(at.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(at);
}

/** Who is away, when, and what people get back. The message is written for you from the rest, and you can change it. */
export function AwayForm({ people, defaults }: { people: PersonOption[]; defaults: { startsAt: string; endsAt: string } }) {
  const [state, run, pending] = useActionState<FormState, FormData>(setAwayAction, {});
  const errors = state.fieldErrors ?? {};
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [reason, setReason] = useState<AwayReason>("leave");
  const [startsAt, setStartsAt] = useState(defaults.startsAt);
  const [endsAt, setEndsAt] = useState(defaults.endsAt);
  const [coverId, setCoverId] = useState("");
  const [urgent, setUrgent] = useState("");
  const [tone, setTone] = useState<"warm" | "formal">("warm");
  const [edited, setEdited] = useState(false);
  const person = people.find((p) => p.id === personId);
  const cover = people.find((p) => p.id === coverId);
  const back = dayName(endsAt);

  const written = useMemo(
    () => outOfOffice({ name: person?.name ?? "", reason, back, cover: cover?.name ?? "", coverEmail: cover?.email ?? "", urgent, company: "", tone }),
    [person, reason, back, cover, urgent, tone],
  );
  const [message, setMessage] = useState(written);
  const [subject, setSubject] = useState("");
  useEffect(() => {
    if (!edited) setMessage(written);
  }, [written, edited]);
  const autoSubject = back ? `Out of office until ${back}` : "Out of office";

  if (!people.length) return <p className="text-body text-ink-muted">Add people to your directory first.</p>;

  return (
    <form action={run} className="flex flex-col gap-5">
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          Who is away
          <select name="personId" className={field} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.email})
              </option>
            ))}
          </select>
          {errors.personId ? <span className="font-normal text-negative">{errors.personId}</span> : null}
        </label>
        <label className={label}>
          Why
          <select name="reason" className={field} value={reason} onChange={(e) => setReason(e.target.value as AwayReason)}>
            {AWAY_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Leaves
          <input name="startsAt" type="datetime-local" className={field} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          {errors.startsAt ? <span className="font-normal text-negative">{errors.startsAt}</span> : null}
        </label>
        <label className={label}>
          Back
          <input name="endsAt" type="datetime-local" className={field} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
          {errors.endsAt ? <span className="font-normal text-negative">{errors.endsAt}</span> : null}
        </label>
        <label className={label}>
          Who covers for them
          <select className={field} value={coverId} onChange={(e) => setCoverId(e.target.value)}>
            <option value="">Nobody named</option>
            {people
              .filter((p) => p.id !== personId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className={label}>
          Number for urgent matters
          <input className={field} value={urgent} onChange={(e) => setUrgent(e.target.value)} placeholder={person?.phone || "Optional"} maxLength={30} />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-callout font-semibold text-ink">Tone</legend>
        <div className="flex gap-2">
          {(["warm", "formal"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tone === t}
              onClick={() => setTone(t)}
              className={cn("h-9 rounded-full border px-4 text-callout", tone === t ? "border-brand bg-brand text-on-brand" : "border-border bg-surface-1 text-ink")}
            >
              {t === "warm" ? "Friendly" : "Formal"}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={label}>
        Subject
        <input name="subject" className={field} value={subject || autoSubject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
        {errors.subject ? <span className="font-normal text-negative">{errors.subject}</span> : null}
      </label>
      <label className={label}>
        <span className="flex items-center justify-between gap-3">
          Message
          {edited ? (
            <button type="button" className="font-normal text-link hover:underline" onClick={() => setEdited(false)}>
              Write it for me again
            </button>
          ) : null}
        </span>
        <textarea
          name="message"
          rows={9}
          className="w-full rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-body font-normal text-ink"
          value={message}
          onChange={(e) => {
            setEdited(true);
            setMessage(e.target.value);
          }}
        />
        {errors.message ? <span className="font-normal text-negative">{errors.message}</span> : null}
      </label>
      <label className="flex items-center gap-2 text-callout text-ink">
        <input type="checkbox" name="withSignature" defaultChecked /> Add their email signature under the message
      </label>
      <p className="text-callout text-ink-muted">
        People synced from Google Workspace get it in Gmail, and those from Microsoft 365 in Outlook. It switches itself on when they leave and off when they&apos;re back.
      </p>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Setting…" : "Set out-of-office"}
      </Button>
    </form>
  );
}

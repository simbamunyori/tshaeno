import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { CLIENT_LABEL, GMAIL_SIGNATURE_LIMIT, type CheckResult, type Client } from "@/lib/signature/check";

const STATE = {
  pass: { Icon: CircleCheck, cls: "text-positive", label: "Works" },
  warn: { Icon: TriangleAlert, cls: "text-warning", label: "Works, with a catch" },
  fail: { Icon: CircleAlert, cls: "text-negative", label: "Needs a fix" },
} as const;

/** How the signature fares in Outlook, Gmail and Apple Mail, and why. */
export function ClientChecks({ result }: { result: CheckResult }) {
  const clients = Object.keys(CLIENT_LABEL) as Client[];
  const shown = result.issues.filter((i) => i.severity !== "note");
  const notes = result.issues.filter((i) => i.severity === "note");
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Mail client checks">
        {clients.map((c) => {
          const s = STATE[result.clients[c]];
          return (
            <li key={c} className="flex items-center gap-1.5 text-callout">
              <s.Icon aria-hidden className={cn("size-4", s.cls)} />
              <span className="font-semibold text-ink">{CLIENT_LABEL[c]}</span>
              <span className="text-ink-muted">{s.label}</span>
            </li>
          );
        })}
        <li className="text-callout text-ink-muted">
          {result.characters.toLocaleString("en")} of {GMAIL_SIGNATURE_LIMIT.toLocaleString("en")} characters Gmail allows
        </li>
      </ul>
      {shown.length ? (
        <ul className="flex flex-col gap-1.5">
          {shown.map((i) => (
            <li key={i.rule} className="flex items-start gap-2 text-callout text-ink">
              {i.severity === "error" ? (
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-negative" />
              ) : (
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              )}
              <span>
                {i.message} <span className="text-ink-muted">({i.clients.map((c) => CLIENT_LABEL[c]).join(", ")})</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {notes.length ? (
        <details className="text-callout text-ink-muted">
          <summary className="cursor-pointer">Small differences between mail clients ({notes.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {notes.map((i) => (
              <li key={i.rule} className="flex items-start gap-2">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                {i.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

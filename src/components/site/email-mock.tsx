import { SignatureThumb } from "@/components/signatures/thumb";

/** A signature shown at the end of an email, the way a recipient sees it. */
export function EmailMock({ html, to, subject, body, title }: { html: string; to: string; subject: string; body: string[]; title: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-elevation-3">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-border-strong/50" />
        <span className="size-2.5 rounded-full bg-border-strong/50" />
        <span className="size-2.5 rounded-full bg-border-strong/50" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-border px-4 py-3 text-callout sm:px-5">
        <dt className="text-ink-muted">To</dt>
        <dd className="truncate text-ink">{to}</dd>
        <dt className="text-ink-muted">Subject</dt>
        <dd className="truncate font-semibold text-ink">{subject}</dd>
      </dl>
      <div className="flex flex-col gap-3 px-4 py-4 text-body text-ink sm:px-5">
        {body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="px-2 pb-3 sm:px-3">
        <SignatureThumb html={html} title={title} />
      </div>
    </figure>
  );
}

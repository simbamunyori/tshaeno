import { SignatureThumb } from "@/components/signatures/thumb";
import { cn } from "@/lib/cn";

/** A signature shown at the end of an email, the way a recipient sees it. */
export function EmailMock({ html, from, to, subject, body, title, className }: { html: string; from: string; to: string; subject: string; body: string[]; title: string; className?: string }) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border border-border bg-surface-1 shadow-elevation-3", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3" aria-hidden>
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <span className="text-[12px] text-ink-muted">Inbox</span>
      </div>
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:px-6">
        <p className="truncate font-display text-[22px] leading-7 text-ink">{subject}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-[13px] leading-5">
          <dt className="text-ink-muted">From</dt>
          <dd className="truncate text-ink">{from}</dd>
          <dt className="text-ink-muted">To</dt>
          <dd className="truncate text-ink">{to}</dd>
        </dl>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-5 text-[14px] leading-6 text-ink sm:px-6">
        {body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="px-2 pb-3 sm:px-3 [&>div]:bg-transparent">
        <SignatureThumb html={html} title={title} />
      </div>
    </figure>
  );
}

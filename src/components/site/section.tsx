import { cn } from "@/lib/cn";

/** A full-width band of the website with a centred column. */
export function Section({ className, inner, children, ...props }: React.HTMLAttributes<HTMLElement> & { inner?: string }) {
  return (
    <section className={cn("px-4 py-16 sm:px-6 sm:py-24", className)} {...props}>
      <div className={cn("mx-auto max-w-[1120px]", inner)}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-callout font-semibold tracking-wide text-link uppercase">{children}</p>;
}

export function SectionTitle({ eyebrow, title, children, id }: { eyebrow?: string; title: string; children?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-10 flex max-w-[680px] flex-col gap-3">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-ink text-balance sm:text-[36px] sm:leading-[42px]">
        {title}
      </h2>
      {children ? <p className="text-[17px] leading-7 text-ink-muted">{children}</p> : null}
    </div>
  );
}

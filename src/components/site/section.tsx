import { cn } from "@/lib/cn";

/** A full-width band of the website with a centred column. */
export function Section({ className, inner, children, ...props }: React.HTMLAttributes<HTMLElement> & { inner?: string }) {
  return (
    <section className={cn("px-4 py-20 sm:px-6 sm:py-28", className)} {...props}>
      <div className={cn("mx-auto max-w-[1200px]", inner)}>{children}</div>
    </section>
  );
}

/** A short label above a heading, with a small rule in the accent colour. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-[12px] leading-4 font-semibold tracking-[0.16em] text-ink-muted uppercase", className)}>
      <span aria-hidden className="h-px w-8 bg-accent" />
      {children}
    </p>
  );
}

/** The large serif heading used across the website. */
export function Display({ as: Tag = "h2", className, children, id }: { as?: "h1" | "h2" | "h3"; className?: string; children: React.ReactNode; id?: string }) {
  return (
    <Tag id={id} className={cn("font-display text-[40px] leading-[44px] font-normal tracking-[-0.01em] text-balance text-ink sm:text-[54px] sm:leading-[58px]", className)}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ eyebrow, title, children, id, className }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("mb-12 flex max-w-[720px] flex-col gap-5 sm:mb-16", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Display id={id}>{title}</Display>
      {children ? <p className="max-w-[600px] text-[18px] leading-[30px] text-ink-muted">{children}</p> : null}
    </div>
  );
}

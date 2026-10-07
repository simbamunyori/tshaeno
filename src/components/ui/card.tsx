import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-lg border border-border bg-surface-1 p-5 sm:p-6", className)} {...props} />;
}

export function CardHeader({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-headline text-ink">{title}</h2>
        {children ? <p className="text-callout text-ink-muted">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}

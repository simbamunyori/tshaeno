"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { INDUSTRY_LINKS, PRODUCT, RESOURCES, TEAMS, type NavLink } from "@/lib/site/nav";

type MenuKey = "product" | "solutions" | "resources";

function Item({ l, onPick }: { l: NavLink; onPick: () => void }) {
  return (
    <Link href={l.href} onClick={onPick} className="group flex flex-col gap-0.5 rounded-lg px-3 py-2.5 hover:bg-surface-2">
      <span className="text-[15px] font-semibold text-ink">{l.label}</span>
      {l.text ? <span className="text-[13px] leading-5 text-ink-muted">{l.text}</span> : null}
    </Link>
  );
}

function Promo({ title, text, href, cta, onPick }: { title: string; text: string; href: string; cta: string; onPick: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-[#14213D] p-6 text-white">
      <p className="font-display text-[26px] leading-8">{title}</p>
      <p className="text-[14px] leading-6 text-white/70">{text}</p>
      <Link href={href} onClick={onPick} className="mt-auto inline-flex items-center gap-2 text-[14px] font-semibold text-[#E3C893] hover:underline">
        {cta} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

const LABEL = (t: string) => <p className="px-3 pb-2 text-[12px] font-semibold tracking-[0.14em] text-ink-muted uppercase">{t}</p>;

/** The desktop menus. Each opens on click or hover and closes on Escape, on a click outside or on navigation. */
export function MegaMenu() {
  const [open, setOpen] = useState<MenuKey | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const close = () => setOpen(null);

  useEffect(() => close(), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const hover = (k: MenuKey | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(k), k ? 80 : 160);
  };
  const trigger = (k: MenuKey, label: string) => (
    <button
      type="button"
      aria-expanded={open === k}
      aria-controls={`menu-${k}`}
      onClick={() => setOpen(open === k ? null : k)}
      onMouseEnter={() => hover(k)}
      className={cn("flex items-center gap-1 rounded-md px-3 py-2 text-[14px] font-medium transition-colors", open === k ? "text-ink" : "text-ink-muted hover:text-ink")}
    >
      {label}
      <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open === k && "rotate-180")} />
    </button>
  );
  const panel = (k: MenuKey, children: React.ReactNode) =>
    open === k ? (
      <div id={`menu-${k}`} className="absolute inset-x-0 top-full border-b border-border bg-surface-1 shadow-elevation-3" onMouseEnter={() => hover(k)} onMouseLeave={() => hover(null)}>
        <div className="mx-auto grid max-w-[1200px] gap-8 px-6 py-8">{children}</div>
      </div>
    ) : null;

  return (
    <div ref={ref} className="hidden flex-1 items-center lg:flex" onMouseLeave={() => hover(null)}>
      <nav aria-label="Main" className="flex items-center gap-0.5">
        {trigger("product", "Product")}
        {trigger("solutions", "Solutions")}
        {trigger("resources", "Resources")}
        <Link href="/pricing" onMouseEnter={() => hover(null)} className="rounded-md px-3 py-2 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink">
          Pricing
        </Link>
        <Link href="/fourth-generation" onMouseEnter={() => hover(null)} className="rounded-md px-3 py-2 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink">
          Fourth Generation
        </Link>
      </nav>
      {panel(
        "product",
        <div className="grid grid-cols-[1fr_1fr_300px] gap-8">
          <div>
            {LABEL("Signatures")}
            {PRODUCT.slice(0, 3).map((l) => (
              <Item key={l.href} l={l} onPick={close} />
            ))}
          </div>
          <div>
            {LABEL("Beyond the signature")}
            {PRODUCT.slice(3).map((l) => (
              <Item key={l.href} l={l} onPick={close} />
            ))}
          </div>
          <Promo title="See it with your logo" text="Half an hour with us, and we'll build your first signature with you." href="/demo" cta="Book a demo" onPick={close} />
        </div>,
      )}
      {panel(
        "solutions",
        <div className="grid grid-cols-[1fr_1.6fr_300px] gap-8">
          <div>
            {LABEL("By team")}
            {TEAMS.map((l) => (
              <Item key={l.href} l={l} onPick={close} />
            ))}
          </div>
          <div>
            {LABEL("By industry")}
            <ul className="grid grid-cols-2 gap-x-4">
              {INDUSTRY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={close} className="block rounded-md px-3 py-1.5 text-[14px] text-ink hover:bg-surface-2">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Promo title="Try it free for 14 days" text="Every feature, your own logo, no card needed." href="/sign-up" cta="Start your free trial" onPick={close} />
        </div>,
      )}
      {panel(
        "resources",
        <div className="grid grid-cols-[1fr_1fr_300px] gap-8">
          <div>
            {LABEL("Learn")}
            {RESOURCES.slice(0, 2).map((l) => (
              <Item key={l.href} l={l} onPick={close} />
            ))}
          </div>
          <div>
            {LABEL("Decide")}
            {RESOURCES.slice(2).map((l) => (
              <Item key={l.href} l={l} onPick={close} />
            ))}
          </div>
          <Promo title="Hosted with Fourth Generation?" text="Your email signatures are free when you move to the Tshaeno console." href="/fourth-generation" cta="How it works" onPick={close} />
        </div>,
      )}
    </div>
  );
}

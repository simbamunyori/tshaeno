import { Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { FONTS } from "@/lib/signature/style";
import { kitOptions } from "@/server/signatures/studio-data";
import { createKitAction } from "./actions";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Brand kits" };

export default async function BrandPage() {
  const { actor, organisation } = await requireMember();
  const kits = await asTenant(organisation.id, (tx) => kitOptions(tx, organisation.id));
  const manage = can(actor, "manageTemplates");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title="Brand kits" />
      <p className="-mt-4 max-w-2xl text-body text-ink-muted">
        Colours, font, logo, company details, disclaimer and social links. Signatures use them by role, so changing a kit changes every signature that uses it.
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {kits.map((k) => (
          <li key={k.id}>
            <Link href={`/app/brand/${k.id}`} className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 hover:border-border-strong">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{k.name}</span>
                {k.isDefault ? <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-caption font-semibold text-link">Default</span> : null}
              </div>
              <div className="flex items-center gap-2" aria-hidden>
                {Object.values(k.brand.colours).map((c, i) => (
                  <span key={i} className="size-8 rounded-full border border-border" style={{ background: c }} />
                ))}
                {k.brand.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={k.brand.logo.url} alt="" className="ml-auto h-8 max-w-[120px] object-contain" />
                ) : (
                  <Palette className="ml-auto size-6 text-ink-muted" />
                )}
              </div>
              <span className="text-callout text-ink-muted">
                {FONTS[k.brand.font].label} · {k.brand.company || "No company name"} · {k.brand.socials.length} social {k.brand.socials.length === 1 ? "link" : "links"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {manage ? (
        <Card>
          <CardHeader title="Add a brand kit">For a sub-brand, a region or an event. It starts as a copy of the default.</CardHeader>
          <form action={createKitAction} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="name" className="text-callout font-semibold text-ink">
                Name
              </label>
              <input id="name" name="name" required maxLength={80} placeholder="For example, Kalahari Logistics" className={inputClass} />
            </div>
            <Button type="submit" size="lg">
              Add kit
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

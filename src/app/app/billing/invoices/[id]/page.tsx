import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Logo } from "@/components/ui/logo";
import { formatMoney } from "@/lib/billing/plans";
import { asTenant } from "@/server/db";
import { env } from "@/server/env";
import { bankDetails, dpoConfig, invoiceIssuer, type BillTo, type InvoiceLine } from "@/server/billing/service";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { PayOnlineButton } from "../../billing-forms";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const fresh = (await searchParams).new === "1";
  const { actor, organisation } = await requireMember();
  const inv = await asTenant(organisation.id, (tx) => tx.invoice.findFirst({ where: { id } }));
  if (!inv) notFound();
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: organisation.timeZone });
  const lines = inv.lines as unknown as InvoiceLine[];
  const bill = inv.billTo as unknown as BillTo;
  const bank = bankDetails();
  const issuer = invoiceIssuer();
  const { TAX_LABEL, TAX_PERCENT } = env();
  const online = !!dpoConfig() && can(actor, "manageBilling");
  const money = (m: number) => formatMoney(m, inv.currency);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/app/billing" className="text-callout font-semibold text-link hover:underline">
          Plan and billing
        </Link>
        <PrintButton />
      </div>
      {fresh && inv.status === "OPEN" ? (
        <Alert tone="info" className="print:hidden">
          Your invoice is ready and we&apos;ve emailed it. {bank.length ? "Pay by bank transfer using the details below, with the invoice number as the reference." : ""} Your plan starts when payment arrives.
        </Alert>
      ) : null}

      <article className="rounded-lg border border-border bg-surface-1 p-6 sm:p-10 print:border-0 print:p-0" aria-label={`Invoice ${inv.number}`}>
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div className="flex flex-col gap-3">
            <Logo size={30} />
            <address className="text-callout not-italic text-ink-muted">
              {issuer.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
          </div>
          <div className="text-right">
            <h1 className="text-title-1 text-ink">{inv.status === "PAID" ? "Receipt" : "Invoice"}</h1>
            <p className="text-body font-semibold text-ink tabular-nums">{inv.number}</p>
            <p
              className={
                inv.status === "PAID"
                  ? "mt-2 inline-block rounded-full bg-positive-soft px-3 py-0.5 text-callout font-semibold text-positive"
                  : inv.status === "VOID"
                    ? "mt-2 inline-block rounded-full bg-surface-2 px-3 py-0.5 text-callout font-semibold text-ink-muted"
                    : "mt-2 inline-block rounded-full bg-warning-soft px-3 py-0.5 text-callout font-semibold text-warning"
              }
            >
              {inv.status === "PAID" ? `Paid ${day.format(inv.paidAt!)}` : inv.status === "VOID" ? "Cancelled" : `Due ${day.format(inv.dueAt)}`}
            </p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-caption font-semibold tracking-wide text-ink-muted uppercase">Billed to</h2>
            <p className="mt-1 font-semibold text-ink">{bill.name}</p>
            {bill.address ? <p className="text-callout whitespace-pre-line text-ink-muted">{bill.address}</p> : null}
            {bill.email ? <p className="text-callout text-ink-muted">{bill.email}</p> : null}
            {bill.taxNumber ? <p className="text-callout text-ink-muted">Tax number {bill.taxNumber}</p> : null}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-callout sm:justify-self-end">
            <dt className="text-ink-muted">Issued</dt>
            <dd className="text-ink">{day.format(inv.issuedAt)}</dd>
            <dt className="text-ink-muted">Period</dt>
            <dd className="text-ink">
              {day.format(inv.periodStart)} to {day.format(inv.periodEnd)}
            </dd>
            {inv.paymentRef ? (
              <>
                <dt className="text-ink-muted">Payment</dt>
                <dd className="text-ink">{inv.paymentRef}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <table className="w-full border-collapse text-callout">
          <thead>
            <tr className="border-b border-border text-left text-ink-muted">
              <th scope="col" className="py-3 font-semibold">
                Description
              </th>
              <th scope="col" className="py-3 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border align-top">
                <td className="py-3 pr-4 text-ink">{l.description}</td>
                <td className="py-3 text-right text-ink tabular-nums">{money(l.amountMinor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {inv.taxMinor > 0 || TAX_PERCENT > 0 ? (
              <>
                <tr>
                  <th scope="row" className="pt-4 text-right font-normal text-ink-muted">
                    Subtotal
                  </th>
                  <td className="pt-4 text-right text-ink tabular-nums">{money(inv.subtotalMinor)}</td>
                </tr>
                <tr>
                  <th scope="row" className="pt-1 text-right font-normal text-ink-muted">
                    {TAX_LABEL}
                  </th>
                  <td className="pt-1 text-right text-ink tabular-nums">{money(inv.taxMinor)}</td>
                </tr>
              </>
            ) : null}
            <tr>
              <th scope="row" className="pt-3 text-right text-headline text-ink">
                Total {inv.currency}
              </th>
              <td className="pt-3 text-right text-headline text-ink tabular-nums">{money(inv.totalMinor)}</td>
            </tr>
          </tfoot>
        </table>

        {inv.status === "OPEN" ? (
          <section className="mt-8 flex flex-col gap-4 rounded-md bg-surface-2 p-5">
            <h2 className="text-headline text-ink">How to pay</h2>
            {online ? <PayOnlineButton id={inv.id} /> : null}
            {bank.length ? (
              <div className="text-callout">
                <p className="font-semibold text-ink">{online ? "Or by bank transfer" : "By bank transfer"}</p>
                {bank.map((l) => (
                  <p key={l} className="text-ink">
                    {l}
                  </p>
                ))}
                <p className="mt-2 text-ink-muted">
                  Use <strong className="text-ink">{inv.number}</strong> as the reference.
                </p>
              </div>
            ) : online ? null : (
              <p className="text-callout text-ink-muted">Our bank details are on their way to you by email. Use {inv.number} as the reference.</p>
            )}
          </section>
        ) : null}
      </article>
    </div>
  );
}

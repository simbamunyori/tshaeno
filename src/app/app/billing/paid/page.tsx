import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { confirmDpoPayment, realBillingDeps, type PaidOutcome } from "@/server/billing/service";
import { requireMember } from "@/server/org/context";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

/** DPO Pay sends people back here after paying. */
export default async function PaidPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { organisation } = await requireMember();
  const token = (await searchParams).TransactionToken ?? "";
  const outcome: PaidOutcome = token ? await confirmDpoPayment(token, realBillingDeps()) : { ok: false, message: "We couldn't tell which payment this was." };
  const mine = outcome.ok ? outcome.invoice.organisationId === organisation.id : !outcome.organisationId || outcome.organisationId === organisation.id;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={organisation.name} title={outcome.ok ? "Payment received" : "Payment not finished"} />
      <Card className="flex flex-col gap-5">
        {outcome.ok ? (
          <Alert tone="positive">Thank you. Your plan is active, and we&apos;ve emailed your receipt.</Alert>
        ) : (
          <Alert tone="warning">{mine ? outcome.message : "This payment belongs to another organisation. Switch to it to see the result."}</Alert>
        )}
        <Button asChild className="self-start">
          <Link href={outcome.ok && mine ? `/app/billing/invoices/${outcome.invoice.id}` : "/app/billing"}>{outcome.ok ? "View receipt" : "Back to billing"}</Link>
        </Button>
      </Card>
    </div>
  );
}

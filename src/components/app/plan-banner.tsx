import { CreditCard } from "lucide-react";
import Link from "next/link";
import { FREE_PEOPLE } from "@/lib/billing/plans";
import { asTenant } from "@/server/db";
import { activePeople, subscriptionOf, summarise } from "@/server/billing/service";

/** A line at the top of every page when the plan needs attention: a trial ending soon, an unpaid renewal, or too many people for free. */
export async function PlanBanner({ organisationId }: { organisationId: string }) {
  const { sub, people } = await asTenant(organisationId, async (tx) => ({ sub: await subscriptionOf(tx, organisationId), people: await activePeople(tx) }));
  if (sub.billedBy === "PARTNER") {
    if (sub.status !== "CANCELLED") return null;
    return (
      <div role="status" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-negative-soft px-4 py-3 text-callout text-ink print:hidden">
        <CreditCard aria-hidden className="size-5 shrink-0 text-negative" />
        <p className="min-w-0 flex-1">Your plan has ended, so signatures are no longer kept up to date.</p>
        <Link href="/app/billing" className="font-semibold text-link hover:underline">
          See your plan
        </Link>
      </div>
    );
  }
  const s = summarise(sub, people);
  let text: string | null = null;
  if (s.status === "TRIALING" && s.trialDaysLeft !== null && s.trialDaysLeft <= 3) {
    text = s.trialDaysLeft === 0 ? "Your free trial ends today." : `Your free trial ends in ${s.trialDaysLeft} ${s.trialDaysLeft === 1 ? "day" : "days"}.`;
  } else if (s.status === "PAST_DUE") {
    text = "Your renewal isn't paid yet. Signatures keep working for now.";
  } else if (s.status === "FREE" && s.over > 0) {
    text = `The free plan covers ${FREE_PEOPLE} people and you have ${people}.`;
  }
  if (!text) return null;
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-brand-soft px-4 py-3 text-callout text-ink print:hidden">
      <CreditCard aria-hidden className="size-5 shrink-0 text-link" />
      <p className="min-w-0 flex-1">{text}</p>
      <Link href="/app/billing" className="font-semibold text-link hover:underline">
        Choose a plan
      </Link>
    </div>
  );
}

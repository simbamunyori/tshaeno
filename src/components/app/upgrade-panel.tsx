import { Lock } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FEATURE_LABEL, type Feature } from "@/lib/billing/features";
import { requestUpgradeAction } from "@/app/app/upgrade/actions";
import { marketplaceUrl } from "@/server/site";

const WHAT: Record<Feature, string> = {
  campaigns: "Put a banner under everyone's signature for a launch, an event or an offer, with dates, teams and clicks counted.",
  reports: "See how well signatures are reaching people, which campaigns get clicked, and what to fix first.",
  claude: "Describe a signature in your own words and Claude drafts it, or ask Claude to check your signatures look consistent.",
  backgrounds: "Give everyone a branded background for Zoom, Teams and Meet, with their own name and title on it.",
  away: "Set out-of-office replies for people in Gmail and Outlook, with your wording and their signature, on the right dates.",
};

/** Shown in place of a premium page when the organisation only has free signatures. */
export function UpgradePanel({ feature, partner, canBill }: { feature: Feature; partner: boolean; canBill: boolean }) {
  const market = partner ? marketplaceUrl() : null;
  return (
    <Card className="flex max-w-2xl flex-col gap-5">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-link">
        <Lock aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-title-2 text-ink">{FEATURE_LABEL[feature]} are part of the full plan</h2>
        <p className="text-body text-ink-muted">{WHAT[feature]}</p>
        <p className="text-body text-ink-muted">
          {partner
            ? "Your email signatures are free through Fourth Generation, and they stay free. To add this, Fourth Generation moves you to the full plan and it appears on the invoice you already get."
            : "Your signatures keep working on the free plan. Choose a plan to add this and the other premium features."}
        </p>
      </div>
      {partner ? (
        <div className="flex flex-col gap-3">
          {market ? (
            <Button asChild className="self-start">
              <a href={market}>Upgrade in the Fourth Generation marketplace</a>
            </Button>
          ) : null}
          {canBill ? (
            <ActionForm action={requestUpgradeAction} submit={market ? "Or ask us to arrange it" : "Ask us to arrange it"} pending="Sending…" variant={market ? "secondary" : "primary"}>
              <input type="hidden" name="feature" value={FEATURE_LABEL[feature]} />
            </ActionForm>
          ) : (
            <p className="text-callout text-ink-muted">Ask an owner of your organisation to arrange it.</p>
          )}
        </div>
      ) : canBill ? (
        <Button asChild className="self-start">
          <Link href="/app/billing">Choose a plan</Link>
        </Button>
      ) : (
        <p className="text-callout text-ink-muted">Ask an owner of your organisation to choose a plan.</p>
      )}
    </Card>
  );
}

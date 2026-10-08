import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { completeMicrosoftConsent } from "@/server/connections/service";
import { kickSync } from "@/server/jobs/queue";

export const metadata: Metadata = { title: "Microsoft 365 consent", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Microsoft sends the admin here after the consent screen. They may not
 * use Tshaeno themselves, so this page works without signing in.
 */
export default async function MicrosoftConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const outcome = await completeMicrosoftConsent({ state: q.state, code: q.code, error: q.error });
  if (outcome.ok && outcome.connection.status === "CONNECTED") await kickSync(outcome.connection.id);
  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <AuthHeading title={outcome.ok ? "Consent granted" : "Consent not finished"} />
        {outcome.ok ? (
          <Alert tone={outcome.connection.status === "CONNECTED" ? "positive" : "warning"}>
            {outcome.connection.status === "CONNECTED"
              ? "Thank you. Tshaeno can now read your Microsoft 365 users and groups, and the first sync has started. You can close this page."
              : "Consent was recorded, but not every check passes yet. The Connections page in Tshaeno says what is missing."}
          </Alert>
        ) : (
          <Alert>{outcome.message}</Alert>
        )}
        <Button asChild size="lg" className="w-full" variant="secondary">
          <Link href="/app/connections">Open Connections in Tshaeno</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { ActionForm } from "@/components/ui/action-form";
import { redeemLinkAction } from "../../actions";

export const metadata: Metadata = { title: "Update your signature", robots: { index: false, follow: false } };

/**
 * A button rather than signing in on page load, so mail scanners that open
 * links don't use up the person's one-time link.
 */
export default async function PortalLink({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell title="Your email signature, your way.">
      <div className="flex flex-col gap-6">
        <AuthHeading title="Update your email signature">Continue to change your photo and social links.</AuthHeading>
        <ActionForm action={redeemLinkAction} submit="Continue" pending="One moment…">
          <input type="hidden" name="token" value={token} />
        </ActionForm>
      </div>
    </AuthShell>
  );
}

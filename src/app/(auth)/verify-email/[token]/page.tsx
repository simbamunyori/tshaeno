import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authDeps } from "@/server/auth/next";
import { lookupEmailToken } from "@/server/auth/service";
import { confirmEmailAction } from "../actions";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const token = decodeURIComponent((await params).token);
  // Opening the link only shows this page. Confirming takes a press, so a
  // mail scanner that opens links can't use it up.
  const found = await lookupEmailToken(authDeps(), token);

  if (found.state === "VALID") {
    return (
      <AuthShell>
        <form action={confirmEmailAction} className="flex flex-col gap-6">
          <AuthHeading title="Confirm your email">Press the button to confirm {found.email} is your address.</AuthHeading>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" size="lg" className="w-full">
            Confirm my email
          </Button>
        </form>
      </AuthShell>
    );
  }

  const text =
    found.state === "CONFIRMED"
      ? "Your email is already confirmed."
      : found.state === "EXPIRED"
        ? "This link has expired. Sign in and press Send a new link at the top of the page."
        : "This link doesn't work. It may be from an older email, or it was cut short when copied. Sign in to send a new one.";
  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <AuthHeading title={found.state === "CONFIRMED" ? "All set" : "This link can't be used"} />
        <Alert tone="info">{text}</Alert>
        <Button asChild variant={found.state === "CONFIRMED" ? "primary" : "secondary"} size="lg" className="w-full">
          <Link href="/app">{found.state === "CONFIRMED" ? "Open Tshaeno" : "Sign in"}</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

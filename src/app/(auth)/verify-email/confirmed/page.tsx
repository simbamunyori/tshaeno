import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Email confirmed", robots: { index: false, follow: false } };

export default function EmailConfirmedPage() {
  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <AuthHeading title="Email confirmed" />
        <Alert tone="positive">Thank you. You can now invite your team.</Alert>
        <Button asChild size="lg" className="w-full">
          <Link href="/app">Open Tshaeno</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

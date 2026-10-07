import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AuthShell } from "@/components/auth/auth-shell";
import { authDeps, currentSession, homeFor, readSessionToken } from "@/server/auth/next";
import { beginAuthenticatorSetup } from "@/server/auth/service";
import { groupSecret } from "@/server/auth/totp";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Protect your account" };

export default async function SetupAuthenticatorPage() {
  const session = await currentSession();
  if (session?.stage !== "SETUP_PENDING" && session?.stage !== "ACTIVE") redirect(homeFor(session));
  // Confirming setup during sign-up signs the person in, and Next.js then
  // re-renders this page. Keep the same component in place so the backup
  // codes stay on screen; the form sends anyone else on.
  const completed = session.user.totpEnabled;
  const fromSettings = session.stage === "ACTIVE";
  const setup = completed ? null : await beginAuthenticatorSetup(authDeps(), (await readSessionToken())!);
  const qrSvg = setup
    ? await QRCode.toString(setup.uri, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#0B1F3A", light: "#FFFFFF" } })
    : "";
  return (
    <AuthShell>
      <SetupForm
        eyebrow={session.user.lastLoginAt === null ? "Step 2 of 2" : undefined}
        completed={completed}
        done={fromSettings && !completed ? "/app/settings/security" : "/app/start"}
        qrSvg={qrSvg}
        secret={setup ? groupSecret(setup.secret) : ""}
        otpauthUri={setup?.uri ?? ""}
      />
    </AuthShell>
  );
}

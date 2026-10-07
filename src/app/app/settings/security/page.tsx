import { CircleCheck, KeyRound, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { enabledProviders } from "@/server/auth/providers";
import { PROVIDER_LABEL } from "@/server/auth/service";
import { prisma } from "@/server/db";
import { requireMember } from "@/server/org/context";
import { removePasskeyAction, unlinkAction } from "../actions";
import { AddPasskey } from "./add-passkey";

export const metadata: Metadata = { title: "Your security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { session, organisation } = await requireMember();
  const [passkeys, identities, codesLeft] = await Promise.all([
    prisma.passkey.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "asc" } }),
    prisma.identity.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "asc" } }),
    prisma.recoveryCode.count({ where: { userId: session.userId, usedAt: null } }),
  ]);
  const providers = enabledProviders();
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: organisation.timeZone });
  const linked = new Set(identities.map((i) => i.provider));
  const canLink = (["GOOGLE", "MICROSOFT"] as const).filter((p) => !linked.has(p) && providers[p === "GOOGLE" ? "google" : "microsoft"]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={session.user.email} title="Your security" />
      {params.linked ? <Alert tone="positive">Linked. You can sign in with it from now on.</Alert> : null}
      {params.message ? <Alert>{params.message.slice(0, 300)}</Alert> : null}
      {params.error ? <Alert>We couldn&apos;t link that account. Try again.</Alert> : null}

      <Card>
        <CardHeader title="Passkeys" action={<AddPasskey />}>
          Sign in with your fingerprint, face or device PIN. Nothing to type and nothing to phish.
        </CardHeader>
        {passkeys.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <KeyRound aria-hidden className="size-5 shrink-0 text-ink-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink">{p.name}</span>
                  <span className="text-callout text-ink-muted">
                    Added {day.format(p.createdAt)}
                    {p.lastUsedAt ? `, last used ${day.format(p.lastUsedAt)}` : ""}
                  </span>
                </span>
                <form action={removePasskeyAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-callout font-semibold text-negative hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-callout text-ink-muted">No passkeys yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Authenticator app">A six-digit code after your password, or after Google or Microsoft.</CardHeader>
        {session.user.totpEnabled ? (
          <p className="flex items-center gap-2 text-ink">
            <CircleCheck aria-hidden className="size-5 text-positive" />
            Set up. {codesLeft} backup {codesLeft === 1 ? "code" : "codes"} left.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <p className="flex items-center gap-2 text-ink-muted">
              <Smartphone aria-hidden className="size-5" />
              Not set up.
            </p>
            <Button asChild variant="secondary">
              <Link href="/setup-authenticator">Set up</Link>
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Google and Microsoft">Sign in with your work account instead of a password.</CardHeader>
        <ul className="flex flex-col divide-y divide-border">
          {identities.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-ink">{PROVIDER_LABEL[i.provider]}</span>
                <span className="truncate text-callout text-ink-muted">{i.email}</span>
              </span>
              <form action={unlinkAction}>
                <input type="hidden" name="id" value={i.id} />
                <button className="text-callout font-semibold text-negative hover:underline">Unlink</button>
              </form>
            </li>
          ))}
        </ul>
        {canLink.length ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {canLink.map((p) => (
              <Button key={p} asChild variant="secondary">
                <a href={`/auth/${p.toLowerCase()}?intent=link`}>Link {PROVIDER_LABEL[p]}</a>
              </Button>
            ))}
          </div>
        ) : identities.length === 0 ? (
          <p className="text-callout text-ink-muted">Not available on this server yet.</p>
        ) : null}
      </Card>
    </div>
  );
}

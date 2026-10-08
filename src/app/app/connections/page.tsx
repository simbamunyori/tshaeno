import type { DirectoryConnection } from "@prisma/client";
import { CircleAlert, CircleCheck, Download } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { serviceAccount, microsoftApp } from "@/server/connections/config";
import { GOOGLE_SCOPES } from "@/server/connections/google";
import { MICROSOFT_PERMISSIONS } from "@/server/connections/microsoft";
import { readHealth } from "@/server/connections/service";
import type { SyncResult } from "@/server/connections/sync";
import { asTenant } from "@/server/db";
import { can } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { disconnectAction, recheckAction, replaceKeyAction, settingsAction, syncNowAction } from "./actions";
import { ConsentLinkForm, CopyValue, GoogleConnectForm } from "./forms";

export const metadata: Metadata = { title: "Connections" };

const STATUS = {
  NONE: { label: "Not connected", tone: "bg-surface-2 text-ink-muted" },
  PENDING: { label: "Not finished", tone: "bg-warning-soft text-warning" },
  CONNECTED: { label: "Connected", tone: "bg-positive-soft text-positive" },
  ERROR: { label: "Needs attention", tone: "bg-negative-soft text-negative" },
} as const;

function Badge({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-callout font-semibold", s.tone)}>{s.label}</span>;
}

/** Set-up steps, folded away once the connection works. */
function SetupSteps({ done, children }: { done: boolean; children: React.ReactNode }) {
  if (!done) return <>{children}</>;
  return (
    <details className="group">
      <summary className="cursor-pointer text-callout font-semibold text-link">Set-up steps</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-callout font-semibold text-link">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className="text-body font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

export default async function ConnectionsPage() {
  const { actor, organisation } = await requireMember();
  const manage = can(actor, "manageOrganisation");
  const since = new Date(Date.now() - 30 * 86400_000);
  const data = await asTenant(organisation.id, async (tx) => {
    const connections = await tx.directoryConnection.findMany();
    const addin = await tx.outlookAddin.findFirst({ select: { id: true } });
    const outlookSeen = await tx.signatureDelivery.count({
      where: { target: "OUTLOOK", appliedAt: { gte: since } },
    });
    const gmail = await tx.signatureDelivery.groupBy({
      by: ["state"],
      where: { target: "GMAIL" },
      _count: true,
    });
    return {
      connections,
      addin,
      outlookSeen,
      gmail: Object.fromEntries(gmail.map((g) => [g.state, g._count])) as Record<string, number>,
    };
  });
  const google = data.connections.find((c) => c.provider === "GOOGLE");
  const microsoft = data.connections.find((c) => c.provider === "MICROSOFT");
  const sa = serviceAccount();
  const msApp = microsoftApp();
  const when = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: organisation.timeZone,
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Connections" />
      <p className="-mt-4 max-w-2xl text-body text-ink-muted">
        Connect Google Workspace or Microsoft 365 to bring in your people and keep them up to date. Signatures then go into Gmail automatically, and into Outlook through the
        add-in.
      </p>
      {!manage ? <Alert tone="info">Only owners and admins can change connections.</Alert> : null}

      <Card>
        <CardHeader title="Google Workspace" action={<Badge status={google?.status ?? "NONE"} />}>
          Reads your users and groups, and sets each person&apos;s Gmail signature.
        </CardHeader>
        {!sa ? (
          <Alert tone="warning">This Tshaeno server isn&apos;t set up to connect Google yet. This is on our side, not yours.</Alert>
        ) : (
          <SetupSteps done={google?.status === "CONNECTED"}>
            <ol className="flex flex-col gap-6">
              <Step n={1} title="Allow Tshaeno in the Google Admin console">
                <p className="text-callout text-ink-muted">
                  Sign in to admin.google.com as a super admin. Go to Security, Access and data control, API controls, then Manage domain-wide delegation. Choose Add new and paste
                  these two values.
                </p>
                <CopyValue label="Client ID" value={sa.clientId} />
                <CopyValue label="OAuth scopes" value={Object.values(GOOGLE_SCOPES).join(",")} />
              </Step>
              <Step n={2} title="Tell Tshaeno which admin to act as">
                <GoogleConnectForm adminEmail={google?.adminEmail ?? ""} disabled={!manage} />
              </Step>
            </ol>
          </SetupSteps>
        )}
        {google ? <ConnectionDetails c={google} when={when} manage={manage} gmail={data.gmail} /> : null}
      </Card>

      <Card>
        <CardHeader title="Microsoft 365" action={<Badge status={microsoft?.tenantId ? microsoft.status : microsoft ? "PENDING" : "NONE"} />}>
          Reads your users and groups from Entra ID. Signatures reach Outlook through the add-in below.
        </CardHeader>
        {!msApp ? (
          <Alert tone="warning">This Tshaeno server isn&apos;t set up to connect Microsoft 365 yet. This is on our side, not yours.</Alert>
        ) : (
          <SetupSteps done={microsoft?.status === "CONNECTED"}>
            <ol className="flex flex-col gap-6">
              <Step n={1} title="Grant consent as a global admin">
                <p className="text-callout text-ink-muted">
                  Tshaeno asks for read access to your users and group membership ({MICROSOFT_PERMISSIONS.join(" and ")}). It can&apos;t read email or change anything in Microsoft
                  365.
                </p>
                <ConsentLinkForm disabled={!manage} again={!!microsoft?.tenantId} />
              </Step>
            </ol>
          </SetupSteps>
        )}
        {microsoft?.tenantId ? <ConnectionDetails c={microsoft} when={when} manage={manage} /> : null}
      </Card>

      <Card>
        <CardHeader title="Outlook add-in">
          Puts each person&apos;s signature into new emails and replies in Outlook on Windows, Mac and the web, and picks the internal or external signature as they add recipients.
        </CardHeader>
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Download your organisation's add-in">
            {manage ? (
              <div>
                <Button asChild variant={data.addin ? "secondary" : "primary"}>
                  <a href="/app/connections/outlook-manifest" download>
                    <Download /> Download the manifest
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-callout text-ink-muted">An owner or admin can download it.</p>
            )}
          </Step>
          <Step n={2} title="Deploy it to everyone">
            <p className="text-callout text-ink-muted">
              In the Microsoft 365 admin centre, go to Settings, Integrated apps, then Upload custom apps. Choose Office Add-in, upload the manifest, and assign it to everyone. It
              can take up to a day to reach every mailbox. People don&apos;t need to do anything.
            </p>
          </Step>
        </ol>
        {data.addin ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5">
            <p className="text-body text-ink">
              The add-in has put in a signature for <strong>{data.outlookSeen}</strong> {data.outlookSeen === 1 ? "person" : "people"} in the last 30 days.
            </p>
            {manage ? (
              <details className="text-callout text-ink-muted">
                <summary className="cursor-pointer font-semibold text-link">Shared the manifest by mistake?</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <p>
                    The manifest has a key that lets the add-in ask for your people&apos;s signatures. Replacing it stops the old manifest working, so you must deploy the new one.
                  </p>
                  <form action={replaceKeyAction}>
                    <Button variant="destructive" size="sm">
                      Replace the key
                    </Button>
                  </form>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function ConnectionDetails({ c, when, manage, gmail }: { c: DirectoryConnection; when: Intl.DateTimeFormat; manage: boolean; gmail?: Record<string, number> }) {
  const health = readHealth(c);
  const result = c.lastSyncResult as unknown as SyncResult | null;
  return (
    <div className="mt-6 flex flex-col gap-6 border-t border-border pt-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-ink">What&apos;s working</h3>
          {manage ? (
            <form action={recheckAction}>
              <input type="hidden" name="id" value={c.id} />
              <Button variant="secondary" size="sm">
                Check again
              </Button>
            </form>
          ) : null}
        </div>
        {health.length === 0 ? (
          <p className="text-callout text-ink-muted">Not checked yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {health.map((h) => (
              <li key={h.key} className="flex items-start gap-3">
                {h.ok ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" /> : <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-negative" />}
                <span className="text-callout">
                  <span className="font-semibold text-ink">{h.label}.</span> <span className="text-ink-muted">{h.message}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {c.checkedAt ? <p className="text-caption text-ink-muted">Checked {when.format(c.checkedAt)}</p> : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-ink">Directory sync</h3>
          {manage && c.status !== "PENDING" ? (
            <form action={syncNowAction}>
              <input type="hidden" name="id" value={c.id} />
              <Button variant="secondary" size="sm">
                Sync now
              </Button>
            </form>
          ) : null}
        </div>
        {c.lastSyncError ? <Alert>{c.lastSyncError}</Alert> : null}
        {c.lastSyncAt && !c.lastSyncError && result ? (
          <p className="text-callout text-ink-muted">
            Last synced {when.format(c.lastSyncAt)}: {result.total} {result.total === 1 ? "person" : "people"} read, {result.added} added, {result.updated} updated,{" "}
            {result.deactivated} switched off
            {result.skipped.length ? `, ${result.skipped.length} skipped` : ""}.
          </p>
        ) : !c.lastSyncAt ? (
          <p className="text-callout text-ink-muted">{c.status === "PENDING" ? "Syncs once every check passes." : "The first sync is on its way."}</p>
        ) : null}
        {result?.skipped.length ? (
          <details className="text-callout text-ink-muted">
            <summary className="cursor-pointer font-semibold text-link">Who was skipped</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {result.skipped.map((s) => (
                <li key={s.email}>
                  {s.email}: {s.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {gmail ? (
          <p className="text-callout text-ink-muted">
            Gmail signatures: {gmail.APPLIED ?? 0} set, {gmail.PENDING ?? 0} waiting, {gmail.FAILED ?? 0} failed, {gmail.SKIPPED ?? 0} without a signature. See{" "}
            <a href="/app/coverage" className="font-semibold text-link hover:underline">
              Coverage
            </a>{" "}
            for who and why.
          </p>
        ) : null}
      </div>

      {manage ? (
        <div className="flex flex-col gap-4">
          <form action={settingsAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={c.id} />
            <label className="flex items-center gap-3 text-callout text-ink">
              <input type="checkbox" name="syncEnabled" defaultChecked={c.syncEnabled} className="size-4 accent-[var(--brand)]" />
              Sync every six hours
            </label>
            {c.provider === "GOOGLE" ? (
              <label className="flex items-center gap-3 text-callout text-ink">
                <input type="checkbox" name="pushEnabled" defaultChecked={c.pushEnabled} className="size-4 accent-[var(--brand)]" />
                Set signatures in Gmail
              </label>
            ) : (
              <input type="hidden" name="pushEnabled" value={c.pushEnabled ? "on" : ""} />
            )}
            <div>
              <Button variant="secondary" size="sm">
                Save settings
              </Button>
            </div>
          </form>
          <details className="text-callout text-ink-muted">
            <summary className="cursor-pointer font-semibold text-negative">Disconnect</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p>People already brought in stay, as if added by hand. Gmail signatures already set stay as they are until someone changes them.</p>
              <form action={disconnectAction}>
                <input type="hidden" name="id" value={c.id} />
                <Button variant="destructive" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

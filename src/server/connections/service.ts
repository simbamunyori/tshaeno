import { Prisma, type ConnectionProvider, type DirectoryConnection, type PrismaClient } from "@prisma/client";
import { isLive, LIVE_ORGANISATION } from "@/server/billing/live";
import { looksLikeEmail, normaliseEmail } from "@/server/auth/service";
import { asSystem, asTenant, type Tx } from "@/server/db";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { googleClient, microsoftApp, microsoftClient, microsoftEndpoints } from "./config";
import type { GoogleClient } from "./google";
import { ProviderError } from "./http";
import { adminConsentUrl, newConsentFlow, redeemConsent, type ConsentFlow, type MicrosoftClient } from "./microsoft";
import { applyDirectory, type SyncResult } from "./sync";
import type { DirectoryClient, HealthItem } from "./types";

/**
 * Connecting an organisation's Google Workspace or Microsoft 365, checking
 * what works, and syncing its people.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

/** Lets tests stand in for Google and Microsoft. */
export interface Providers {
  google: () => GoogleClient | null;
  microsoft: (tenantId: string) => MicrosoftClient | null;
  /** Swaps the code from the consent sign-in for the admin's verified tenant. */
  redeemConsent: (code: string, redirectUri: string, flow: Pick<ConsentFlow, "nonce" | "verifier">) => Promise<{ tenantId: string; adminName: string }>;
}

export const realProviders: Providers = {
  google: googleClient,
  microsoft: microsoftClient,
  redeemConsent: (code, redirectUri, flow) => {
    const app = microsoftApp();
    if (!app) throw new ProviderError("not-configured", "This Tshaeno server isn't set up to connect Microsoft 365 yet.");
    return redeemConsent(app, code, redirectUri, flow, fetch, microsoftEndpoints());
  },
};

/** How long a consent link works for. */
export const CONSENT_LINK_DAYS = 7;

interface StoredFlow {
  nonce: string;
  verifier: string;
  redirectUri: string;
  createdAt: string;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });
export const PROVIDER_LABEL: Record<ConnectionProvider, string> = { GOOGLE: "Google Workspace", MICROSOFT: "Microsoft 365" };

export function readHealth(c: Pick<DirectoryConnection, "health">): HealthItem[] {
  return Array.isArray(c.health) ? (c.health as unknown as HealthItem[]) : [];
}

const NOT_CONFIGURED = (provider: ConnectionProvider): HealthItem => ({
  key: "server",
  label: "Tshaeno's side",
  ok: false,
  message: `This Tshaeno server isn't set up to connect ${PROVIDER_LABEL[provider]} yet. This is on our side, not yours.`,
});

async function runHealth(c: DirectoryConnection, providers: Providers): Promise<HealthItem[]> {
  if (c.provider === "GOOGLE") {
    const client = providers.google();
    if (!client) return [NOT_CONFIGURED("GOOGLE")];
    if (!c.adminEmail) return [{ key: "admin", label: "Admin account", ok: false, message: "Enter a Google Workspace super admin's email." }];
    return client.health(c.adminEmail);
  }
  if (!c.tenantId) return [{ key: "consent", label: "Consent", ok: false, message: "Your Microsoft 365 admin hasn't granted consent yet." }];
  const client = providers.microsoft(c.tenantId);
  if (!client) return [NOT_CONFIGURED("MICROSOFT")];
  return client.health();
}

/** Runs the checks and stores what they found. Works across organisations, for the worker and callbacks. */
export async function checkConnection(connectionId: string, providers: Providers = realProviders, db?: PrismaClient): Promise<DirectoryConnection> {
  const c = await asSystem((tx) => tx.directoryConnection.findUniqueOrThrow({ where: { id: connectionId } }), db);
  const health = await runHealth(c, providers);
  // Gmail access only matters while Tshaeno is meant to set Gmail signatures.
  const counted = health.filter((h) => h.key !== "gmail" || c.pushEnabled);
  const ok = counted.length > 0 && counted.every((h) => h.ok);
  return asSystem(
    (tx) =>
      tx.directoryConnection.update({
        where: { id: c.id },
        data: {
          health: health as unknown as Prisma.InputJsonValue,
          checkedAt: new Date(),
          status: ok ? "CONNECTED" : c.status === "CONNECTED" || c.status === "ERROR" ? "ERROR" : "PENDING",
        },
      }),
    db,
  );
}

// ─── Setting up ────────────────────────────────────────────────────

export async function connectGoogle(ctx: Ctx, adminEmailInput: string, providers: Providers = realProviders) {
  assertCan(ctx.actor, "manageOrganisation");
  const adminEmail = normaliseEmail(adminEmailInput);
  if (!looksLikeEmail(adminEmail)) throw new DomainError("invalid", "Enter the email of a Google Workspace super admin.", "adminEmail");
  const c = await asTenant(
    ctx.organisationId,
    async (tx) => {
      const c = await tx.directoryConnection.upsert({
        where: { organisationId_provider: { organisationId: ctx.organisationId, provider: "GOOGLE" } },
        create: { organisationId: ctx.organisationId, provider: "GOOGLE", adminEmail },
        update: { adminEmail },
      });
      await audit(tx, ctx.organisationId, who(ctx.actor), "connection.google_set_up", { type: "DirectoryConnection", id: c.id }, { adminEmail }, ctx.ipAddress);
      return c;
    },
    ctx.db,
  );
  return checkConnection(c.id, providers, ctx.db);
}

/** A fresh consent link to send to the Microsoft 365 admin. Each new link replaces the last. */
export async function microsoftConsentLink(ctx: Ctx, redirectUri: string): Promise<string> {
  assertCan(ctx.actor, "manageOrganisation");
  const app = microsoftApp();
  if (!app) throw new DomainError("conflict", "This Tshaeno server isn't set up to connect Microsoft 365 yet.");
  const flow = newConsentFlow();
  const stored: StoredFlow = { nonce: flow.nonce, verifier: flow.verifier, redirectUri, createdAt: new Date().toISOString() };
  const data = { consentState: flow.state, consentFlow: stored as unknown as Prisma.InputJsonValue };
  await asTenant(
    ctx.organisationId,
    (tx) =>
      tx.directoryConnection.upsert({
        where: { organisationId_provider: { organisationId: ctx.organisationId, provider: "MICROSOFT" } },
        create: { organisationId: ctx.organisationId, provider: "MICROSOFT", ...data },
        update: data,
      }),
    ctx.db,
  );
  return adminConsentUrl(app, redirectUri, flow, microsoftEndpoints());
}

export type ConsentOutcome = { ok: true; organisationId: string; connection: DirectoryConnection } | { ok: false; organisationId: string | null; message: string };

/**
 * Microsoft sends the admin back here after they sign in and consent. The
 * state says which organisation asked and works once; the tenant comes
 * from Microsoft's signed id_token, never from the address bar, so nobody
 * can point an organisation at someone else's directory. The admin needn't
 * be signed in to Tshaeno, so this works across organisations.
 */
export async function completeMicrosoftConsent(
  params: { state?: string | null; code?: string | null; error?: string | null },
  providers: Providers = realProviders,
  db?: PrismaClient,
  now = new Date(),
): Promise<ConsentOutcome> {
  if (!params.state) return { ok: false, organisationId: null, message: "This link is incomplete. Start again from Tshaeno." };
  const c = await asSystem((tx) => tx.directoryConnection.findUnique({ where: { consentState: params.state! } }), db);
  const flow = c?.consentFlow as unknown as StoredFlow | null;
  if (!c || !flow?.verifier) return { ok: false, organisationId: null, message: "This link has already been used or has expired. Start again from Tshaeno." };
  // Used or not, the state works once.
  await asSystem((tx) => tx.directoryConnection.update({ where: { id: c.id }, data: { consentState: null, consentFlow: Prisma.DbNull } }), db);
  if (now.getTime() - new Date(flow.createdAt).getTime() > CONSENT_LINK_DAYS * 86_400_000) {
    return { ok: false, organisationId: c.organisationId, message: "This link has expired. Make a new one on the Connections page in Tshaeno." };
  }
  if (params.error || !params.code) {
    const message = params.error === "access_denied" ? "Consent wasn't granted. Ask a Microsoft 365 global admin to open the link and accept." : "Microsoft couldn't complete consent. Make a new link and try again.";
    return { ok: false, organisationId: c.organisationId, message };
  }
  let consent;
  try {
    consent = await providers.redeemConsent(params.code, flow.redirectUri, flow);
  } catch (e) {
    if (e instanceof ProviderError) return { ok: false, organisationId: c.organisationId, message: `${e.message.replace(/ Try the consent link again\.$/, "")} Make a new link in Tshaeno and try again.` };
    throw e;
  }
  const taken = await asSystem((tx) => tx.directoryConnection.findFirst({ where: { provider: "MICROSOFT", tenantId: consent.tenantId, NOT: { id: c.id } }, select: { id: true } }), db);
  if (taken) return { ok: false, organisationId: c.organisationId, message: "This Microsoft 365 organisation is already connected to another Tshaeno account." };
  await asSystem(async (tx) => {
    await tx.directoryConnection.update({ where: { id: c.id }, data: { tenantId: consent.tenantId } });
    await audit(tx, c.organisationId, { userId: null, name: consent.adminName }, "connection.microsoft_consented", { type: "DirectoryConnection", id: c.id }, { tenantId: consent.tenantId });
  }, db);
  const connection = await checkConnection(c.id, providers, db);
  return { ok: true, organisationId: c.organisationId, connection };
}

export async function recheck(ctx: Ctx, connectionId: string, providers: Providers = realProviders) {
  assertCan(ctx.actor, "manageOrganisation");
  await findConnection(ctx, connectionId);
  return checkConnection(connectionId, providers, ctx.db);
}

async function findConnection(ctx: Ctx, connectionId: string): Promise<DirectoryConnection> {
  const c = await asTenant(ctx.organisationId, (tx) => tx.directoryConnection.findFirst({ where: { id: connectionId } }), ctx.db);
  if (!c) throw new DomainError("not-found", "That connection doesn't exist.");
  return c;
}

export async function updateConnection(ctx: Ctx, connectionId: string, input: { syncEnabled?: boolean; pushEnabled?: boolean }) {
  assertCan(ctx.actor, "manageOrganisation");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const c = await tx.directoryConnection.findFirst({ where: { id: connectionId } });
      if (!c) throw new DomainError("not-found", "That connection doesn't exist.");
      const updated = await tx.directoryConnection.update({ where: { id: c.id }, data: input });
      await audit(tx, ctx.organisationId, who(ctx.actor), "connection.changed", { type: "DirectoryConnection", id: c.id }, { provider: c.provider, ...input }, ctx.ipAddress);
      return updated;
    },
    ctx.db,
  );
}

/**
 * Removes the connection. People it brought in stay, as people added by
 * hand, so their signatures keep working in Outlook and can be edited.
 */
export async function disconnect(ctx: Ctx, connectionId: string) {
  assertCan(ctx.actor, "manageOrganisation");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const c = await tx.directoryConnection.findFirst({ where: { id: connectionId } });
      if (!c) throw new DomainError("not-found", "That connection doesn't exist.");
      await tx.directoryConnection.delete({ where: { id: c.id } });
      await tx.person.updateMany({ where: { source: c.provider }, data: { source: "MANUAL", externalId: null } });
      if (c.provider === "GOOGLE") await tx.signatureDelivery.deleteMany({ where: { target: "GMAIL" } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "connection.removed", { type: "DirectoryConnection", id: c.id }, { provider: c.provider }, ctx.ipAddress);
    },
    ctx.db,
  );
}

// ─── Syncing ───────────────────────────────────────────────────────

function directoryClient(c: DirectoryConnection, providers: Providers): DirectoryClient {
  if (c.provider === "GOOGLE") {
    const g = providers.google();
    if (!g) throw new ProviderError("not-configured", NOT_CONFIGURED("GOOGLE").message);
    if (!c.adminEmail) throw new ProviderError("invalid", "Enter a Google Workspace super admin's email first.");
    return { listUsers: () => g.listUsers(c.adminEmail!) };
  }
  if (!c.tenantId) throw new ProviderError("access", "Your Microsoft 365 admin hasn't granted consent yet.");
  const m = providers.microsoft(c.tenantId);
  if (!m) throw new ProviderError("not-configured", NOT_CONFIGURED("MICROSOFT").message);
  return m;
}

export type SyncOutcome = { ok: true; organisationId: string; result: SyncResult } | { ok: false; message: string; retryable: boolean };

/**
 * Reads the whole directory and applies it. Runs in the worker; the
 * outcome is stored on the connection for the connections page.
 */
export async function syncConnection(connectionId: string, providers: Providers = realProviders, db?: PrismaClient): Promise<SyncOutcome> {
  const c = await asSystem((tx) => tx.directoryConnection.findUnique({ where: { id: connectionId } }), db);
  if (!c) return { ok: false, message: "The connection was removed.", retryable: false };
  if (!(await asSystem((tx) => isLive(tx, c.organisationId), db))) return { ok: false, message: "This organisation is suspended or its plan has ended.", retryable: false };
  const fail = async (message: string, retryable: boolean): Promise<SyncOutcome> => {
    await asSystem((tx) => tx.directoryConnection.update({ where: { id: c.id }, data: { lastSyncError: message, lastSyncAt: new Date(), ...(retryable ? {} : { status: "ERROR" as const }) } }), db);
    return { ok: false, message, retryable };
  };
  let users;
  try {
    users = await directoryClient(c, providers).listUsers();
  } catch (e) {
    if (e instanceof ProviderError) return fail(e.message, e.retryable);
    throw e;
  }
  try {
    const result = await asTenant(
      c.organisationId,
      async (tx) => {
        const result = await applyDirectory(tx, c.organisationId, c.provider, users);
        await tx.directoryConnection.update({
          where: { id: c.id },
          data: { lastSyncAt: new Date(), lastSyncError: null, lastSyncResult: { ...result, skipped: result.skipped.slice(0, 50) } as unknown as Prisma.InputJsonValue },
        });
        await audit(tx, c.organisationId, { userId: null, name: PROVIDER_LABEL[c.provider] }, "directory.synced", { type: "DirectoryConnection", id: c.id }, {
          added: result.added,
          updated: result.updated,
          deactivated: result.deactivated,
          skipped: result.skipped.length,
        });
        return result;
      },
      db,
      { timeout: 300_000 },
    );
    return { ok: true, organisationId: c.organisationId, result };
  } catch (e) {
    if (e instanceof ProviderError) return fail(e.message, false);
    throw e;
  }
}

/** Connections whose scheduled sync is due: never synced, or not for six hours. */
export async function dueForSync(now = new Date(), db?: PrismaClient): Promise<string[]> {
  const before = new Date(now.getTime() - 6 * 3600_000);
  const rows = await asSystem(
    (tx) =>
      tx.directoryConnection.findMany({
        where: { syncEnabled: true, status: { in: ["CONNECTED", "ERROR"] }, organisation: LIVE_ORGANISATION, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: before } }] },
        select: { id: true },
      }),
    db,
  );
  return rows.map((r) => r.id);
}

export async function connectionsOf(tx: Tx) {
  return tx.directoryConnection.findMany({ orderBy: { provider: "asc" } });
}

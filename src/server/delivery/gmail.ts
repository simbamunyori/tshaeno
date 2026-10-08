import type { PrismaClient } from "@prisma/client";
import { appOrigin } from "@/server/env";
import { asSystem, asTenant } from "@/server/db";
import { ProviderError } from "@/server/connections/http";
import { realProviders, type Providers } from "@/server/connections/service";
import { PHOTO_SELECT } from "@/server/signatures/people";
import { OrgRenderer } from "./renderer";

/**
 * Pushing signatures into Gmail. Gmail keeps one signature per address,
 * so it gets the one for new emails to people outside the organisation
 * (or, failing that, for replies). Each person is pushed as a separate
 * job with its own retries, and their delivery row says how it went.
 */

export const GMAIL_CONTEXT = { compose: "new", audience: "external" } as const;
const REPLY_CONTEXT = { compose: "reply", audience: "external" } as const;

export const NO_RULE = "No signature rule covers them.";
export const INACTIVE = "Suspended or removed in the directory.";

interface Opts {
  providers?: Providers;
  db?: PrismaClient;
  origin?: string;
}

async function googleFor(organisationId: string, db?: PrismaClient) {
  return asSystem((tx) => tx.directoryConnection.findFirst({ where: { organisationId, provider: "GOOGLE" } }), db);
}

/**
 * Works out whose Gmail signature is out of date and marks them waiting.
 * Returns the people to push. With `force`, everyone is pushed again, which
 * puts back any signature someone changed by hand in Gmail.
 */
export async function planGmail(organisationId: string, opts: Opts & { force?: boolean } = {}): Promise<string[]> {
  const conn = await googleFor(organisationId, opts.db);
  if (!conn?.pushEnabled || conn.status === "PENDING") return [];
  const origin = opts.origin ?? appOrigin().origin;
  return asTenant(
    organisationId,
    async (tx) => {
      const renderer = new OrgRenderer(tx, organisationId, origin);
      const people = await tx.person.findMany({ where: { source: "GOOGLE" }, include: { ...PHOTO_SELECT, deliveries: { where: { target: "GMAIL" } } } });
      const push: string[] = [];
      for (const p of people) {
        const current = p.deliveries[0];
        const set = async (data: { state: "PENDING" | "SKIPPED"; lastError?: string | null; templateId?: string | null }) => {
          if (current && current.state === data.state && current.lastError === (data.lastError ?? null) && data.state === "SKIPPED") return;
          await tx.signatureDelivery.upsert({
            where: { personId_target: { personId: p.id, target: "GMAIL" } },
            create: { organisationId, personId: p.id, target: "GMAIL", ...data },
            update: { ...data, ...(data.state === "PENDING" ? { attempts: 0 } : {}) },
          });
        };
        if (!p.active) {
          await set({ state: "SKIPPED", lastError: INACTIVE });
          continue;
        }
        const out = (await renderer.render(p, GMAIL_CONTEXT)) ?? (await renderer.render(p, REPLY_CONTEXT));
        if (!out) {
          await set({ state: "SKIPPED", lastError: NO_RULE, templateId: null });
          continue;
        }
        if (!opts.force && current?.state === "APPLIED" && current.hash === out.hash) continue;
        if (!opts.force && current?.state === "PENDING" && current.hash === out.hash) continue;
        await set({ state: "PENDING", lastError: null, templateId: out.templateId });
        push.push(p.id);
      }
      return push;
    },
    opts.db,
    { timeout: 300_000 },
  );
}

export type PushOutcome = "applied" | "skipped" | "retry" | "failed";

/**
 * Sets one person's Gmail signature. On a problem that may pass (Google
 * busy, network), records it and returns "retry" so the job tries again;
 * on the last attempt, or a problem retrying won't fix, marks it failed.
 */
export async function pushGmail(organisationId: string, personId: string, opts: Opts & { final?: boolean } = {}): Promise<PushOutcome> {
  const providers = opts.providers ?? realProviders;
  const conn = await googleFor(organisationId, opts.db);
  if (!conn?.pushEnabled) return "skipped";
  const origin = opts.origin ?? appOrigin().origin;
  const prepared = await asTenant(
    organisationId,
    async (tx) => {
      const p = await tx.person.findFirst({ where: { id: personId }, include: PHOTO_SELECT });
      if (!p || !p.active || p.source !== "GOOGLE") return null;
      const renderer = new OrgRenderer(tx, organisationId, origin);
      const out = (await renderer.render(p, GMAIL_CONTEXT)) ?? (await renderer.render(p, REPLY_CONTEXT));
      return out ? { email: p.email, ...out } : null;
    },
    opts.db,
  );
  if (!prepared) return "skipped";

  const record = (data: { state: "APPLIED" | "PENDING" | "FAILED"; lastError: string | null; hash?: string; appliedAt?: Date }) =>
    asTenant(
      organisationId,
      (tx) =>
        tx.signatureDelivery.upsert({
          where: { personId_target: { personId, target: "GMAIL" } },
          create: { organisationId, personId, target: "GMAIL", templateId: prepared.templateId, attempts: 1, ...data },
          update: { templateId: prepared.templateId, attempts: { increment: 1 }, ...data },
        }),
      opts.db,
    );

  const google = providers.google();
  if (!google) {
    await record({ state: "FAILED", lastError: "This Tshaeno server isn't set up for Google yet." });
    return "failed";
  }
  try {
    await google.setSignature(prepared.email, prepared.html);
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    const again = e.retryable && !opts.final;
    await record({ state: again ? "PENDING" : "FAILED", lastError: e.message });
    return again ? "retry" : "failed";
  }
  await record({ state: "APPLIED", lastError: null, hash: prepared.hash, appliedAt: new Date() });
  return "applied";
}

/** Organisations pushing to Gmail, for the nightly pass. */
export async function gmailOrganisations(db?: PrismaClient): Promise<string[]> {
  const rows = await asSystem((tx) => tx.directoryConnection.findMany({ where: { provider: "GOOGLE", pushEnabled: true, status: { not: "PENDING" } }, select: { organisationId: true } }), db);
  return rows.map((r) => r.organisationId);
}

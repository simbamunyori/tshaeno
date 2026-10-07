import type { Prisma } from "@prisma/client";
import type { Tx } from "@/server/db";
import { looksLikeEmail, normaliseEmail } from "@/server/auth/service";
import { ProviderError } from "./http";
import type { DirectoryUser } from "./types";

/**
 * Brings the directory's people into Tshaeno. The directory owns the
 * details it reports (name, title, department, phones, location, groups
 * and any custom fields mapped to its attributes); photos and other
 * custom fields stay as they are. Nobody is deleted: people who leave the
 * directory, or are suspended, stop getting a signature.
 */

export interface SyncResult {
  total: number;
  added: number;
  updated: number;
  deactivated: number;
  /** People we couldn't take, with the reason. */
  skipped: { email: string; reason: string }[];
}

type Provider = "GOOGLE" | "MICROSOFT";

const clip = (v: string, max = 120) => v.trim().replace(/\s+/g, " ").slice(0, max);

/** Don't let a sync that suddenly sees far fewer people switch most of the organisation off. */
function guard(existingSynced: number, seen: number) {
  if (existingSynced > 0 && seen === 0) {
    throw new ProviderError("invalid", "The directory returned nobody, so nothing was changed. Check the connection's permissions.");
  }
  if (existingSynced >= 20 && seen < existingSynced / 2) {
    throw new ProviderError(
      "invalid",
      `The directory returned ${seen} people where there were ${existingSynced}, so nothing was changed. If that is right, disconnect and connect again.`,
    );
  }
}

export async function applyDirectory(tx: Tx, organisationId: string, provider: Provider, users: DirectoryUser[], now = new Date()): Promise<SyncResult> {
  const mapped = (await tx.customField.findMany({ where: { sourceAttribute: { not: null } }, select: { key: true, sourceAttribute: true } })).map((f) => ({
    key: f.key,
    attribute: f.sourceAttribute!,
  }));
  const people = await tx.person.findMany({
    select: {
      id: true,
      email: true,
      externalId: true,
      source: true,
      active: true,
      firstName: true,
      lastName: true,
      title: true,
      department: true,
      phone: true,
      mobile: true,
      location: true,
      groups: true,
      custom: true,
    },
  });
  const byExternal = new Map(people.filter((p) => p.source === provider && p.externalId).map((p) => [p.externalId!, p] as const));
  const byEmail = new Map(people.map((p) => [p.email, p] as const));
  const synced = people.filter((p) => p.source === provider && p.active).length;
  guard(synced, users.filter((u) => u.active).length);

  const result: SyncResult = { total: users.length, added: 0, updated: 0, deactivated: 0, skipped: [] };
  const seen = new Set<string>();
  const seenEmails = new Set<string>();
  const fresh: Prisma.PersonCreateManyInput[] = [];
  const unchanged: string[] = [];

  for (const u of users) {
    const email = normaliseEmail(u.email);
    if (!looksLikeEmail(email)) {
      result.skipped.push({ email: u.email || u.externalId, reason: "No usable email address." });
      continue;
    }
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    const match = byExternal.get(u.externalId) ?? byEmail.get(email);
    if (match && match.source !== provider && (match.source === "GOOGLE" || match.source === "MICROSOFT")) {
      result.skipped.push({ email, reason: `Already comes from ${match.source === "GOOGLE" ? "Google" : "Microsoft"}.` });
      continue;
    }
    const clash = byEmail.get(email);
    if (match && clash && clash.id !== match.id) {
      result.skipped.push({ email, reason: "Someone else in the directory already has this email." });
      continue;
    }

    const custom = { ...((match?.custom as Record<string, string> | undefined) ?? {}) };
    for (const m of mapped) {
      const v = clip(u.attributes[m.attribute] ?? "", 300);
      if (v) custom[m.key] = v;
      else delete custom[m.key];
    }
    const data = {
      email,
      firstName: clip(u.firstName) || email.split("@")[0],
      lastName: clip(u.lastName),
      title: clip(u.title),
      department: clip(u.department),
      phone: clip(u.phone, 40),
      mobile: clip(u.mobile, 40),
      location: clip(u.location),
      groups: [...new Set(u.groups.map((g) => clip(g, 200)).filter(Boolean))].sort(),
      active: u.active,
      custom,
    };

    if (!match) {
      fresh.push({ ...data, organisationId, source: provider, externalId: u.externalId, syncedAt: now });
      byEmail.set(email, { id: "", ...data, externalId: u.externalId, source: provider });
      continue;
    }
    seen.add(match.id);
    const changed =
      match.source !== provider ||
      match.externalId !== u.externalId ||
      (Object.keys(data) as (keyof typeof data)[]).some((k) => JSON.stringify(match[k]) !== JSON.stringify(data[k]));
    if (changed) {
      await tx.person.update({ where: { id: match.id }, data: { ...data, source: provider, externalId: u.externalId, syncedAt: now } });
      result.updated++;
    } else {
      unchanged.push(match.id);
    }
  }
  for (let i = 0; i < unchanged.length; i += 1000) await tx.person.updateMany({ where: { id: { in: unchanged.slice(i, i + 1000) } }, data: { syncedAt: now } });

  for (let i = 0; i < fresh.length; i += 500) await tx.person.createMany({ data: fresh.slice(i, i + 500) });
  result.added = fresh.length;

  const gone = people.filter((p) => p.source === provider && p.active && !seen.has(p.id)).map((p) => p.id);
  if (gone.length) {
    await tx.person.updateMany({ where: { id: { in: gone } }, data: { active: false } });
    result.deactivated = gone.length;
  }
  return result;
}

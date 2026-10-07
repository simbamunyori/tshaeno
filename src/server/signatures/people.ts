import type { Person, PrismaClient } from "@prisma/client";
import { asTenant, type Tx } from "@/server/db";
import { looksLikeEmail, normaliseEmail } from "@/server/auth/service";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { mapHeaders, parseCsv } from "@/lib/csv";
import type { PersonData } from "@/lib/signature/types";
import { imageRef, processImage, saveAsset } from "./assets";

/**
 * The directory: the people who get signatures, with the details their
 * signatures show. Filled by hand or from a spreadsheet now; synced from
 * Google Workspace and Microsoft 365 in milestone S3.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

const who = (a: Actor) => ({ userId: a.userId, name: a.name });

export const MAX_IMPORT_ROWS = 10_000;
export const MAX_CUSTOM_FIELDS = 20;

export interface PersonInput {
  email: string;
  firstName: string;
  lastName?: string;
  title?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  custom?: Record<string, string>;
}

const LIMIT = 120;
const clip = (v: string | undefined, max = LIMIT) => (v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

function clean(input: PersonInput, customKeys: string[]) {
  const email = normaliseEmail(input.email ?? "");
  if (!looksLikeEmail(email)) throw new DomainError("invalid", "Enter an email address like name@company.com.", "email");
  const firstName = clip(input.firstName);
  if (!firstName) throw new DomainError("invalid", "Enter a first name.", "firstName");
  const custom: Record<string, string> = {};
  for (const k of customKeys) {
    const v = clip(input.custom?.[k], 300);
    if (v) custom[k] = v;
  }
  return {
    email,
    firstName,
    lastName: clip(input.lastName),
    title: clip(input.title),
    department: clip(input.department),
    phone: clip(input.phone, 40),
    mobile: clip(input.mobile, 40),
    custom,
  };
}

async function customKeys(tx: Tx): Promise<string[]> {
  return (await tx.customField.findMany({ select: { key: true }, orderBy: { createdAt: "asc" } })).map((f) => f.key);
}

export async function savePerson(ctx: Ctx, personId: string | null, input: PersonInput) {
  assertCan(ctx.actor, "manageDirectory");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const data = clean(input, await customKeys(tx));
      const clash = await tx.person.findFirst({ where: { email: data.email, ...(personId ? { id: { not: personId } } : {}) }, select: { id: true } });
      if (clash) throw new DomainError("conflict", "Someone in the directory already has that email.", "email");
      if (personId) {
        const existing = await tx.person.findFirst({ where: { id: personId } });
        if (!existing) throw new DomainError("not-found", "That person isn't in the directory.");
        const person = await tx.person.update({ where: { id: personId }, data });
        await audit(tx, ctx.organisationId, who(ctx.actor), "person.updated", { type: "Person", id: person.id }, { email: person.email }, ctx.ipAddress);
        return person;
      }
      const person = await tx.person.create({ data: { ...data, organisationId: ctx.organisationId, source: "MANUAL" } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "person.added", { type: "Person", id: person.id }, { email: person.email }, ctx.ipAddress);
      return person;
    },
    ctx.db,
  );
}

export async function removePerson(ctx: Ctx, personId: string) {
  assertCan(ctx.actor, "manageDirectory");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const person = await tx.person.findFirst({ where: { id: personId } });
      if (!person) throw new DomainError("not-found", "That person isn't in the directory.");
      await tx.person.delete({ where: { id: person.id } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "person.removed", { type: "Person", id: person.id }, { email: person.email }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function setPersonPhoto(ctx: Ctx, personId: string, file: Buffer | null) {
  assertCan(ctx.actor, "manageDirectory");
  const img = file ? await processImage(file, "PHOTO") : null;
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const person = await tx.person.findFirst({ where: { id: personId } });
      if (!person) throw new DomainError("not-found", "That person isn't in the directory.");
      const asset = img ? await saveAsset(tx, ctx.organisationId, "PHOTO", img) : null;
      await tx.person.update({ where: { id: person.id }, data: { photoAssetId: asset?.id ?? null } });
      await audit(tx, ctx.organisationId, who(ctx.actor), asset ? "person.photo_changed" : "person.photo_removed", { type: "Person", id: person.id }, { email: person.email }, ctx.ipAddress);
    },
    ctx.db,
  );
}

// ─── Custom fields ─────────────────────────────────────────────────

export function fieldKey(label: string): string {
  const words = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join("").slice(0, 40);
}

export async function addCustomField(ctx: Ctx, label: string) {
  assertCan(ctx.actor, "manageDirectory");
  const clean = label.trim().replace(/\s+/g, " ");
  const key = fieldKey(clean);
  if (!clean || clean.length > 60 || !/^[a-z]/.test(key)) throw new DomainError("invalid", "Enter a name that starts with a letter, under 60 characters.", "label");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      if ((await tx.customField.count()) >= MAX_CUSTOM_FIELDS) throw new DomainError("conflict", `You can have up to ${MAX_CUSTOM_FIELDS} custom fields.`, "label");
      if (await tx.customField.findFirst({ where: { key } })) throw new DomainError("conflict", "There's already a field with that name.", "label");
      const field = await tx.customField.create({ data: { organisationId: ctx.organisationId, key, label: clean } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "directory.field_added", { type: "CustomField", id: field.id }, { key, label: clean }, ctx.ipAddress);
      return field;
    },
    ctx.db,
  );
}

export async function removeCustomField(ctx: Ctx, fieldId: string) {
  assertCan(ctx.actor, "manageDirectory");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const field = await tx.customField.findFirst({ where: { id: fieldId } });
      if (!field) throw new DomainError("not-found", "That field doesn't exist.");
      await tx.customField.delete({ where: { id: field.id } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "directory.field_removed", { type: "CustomField", id: field.id }, { key: field.key }, ctx.ipAddress);
    },
    ctx.db,
  );
}

// ─── Spreadsheet import ────────────────────────────────────────────

export interface ImportResult {
  added: number;
  updated: number;
  skipped: { row: number; reason: string }[];
}

/**
 * Adds or updates people from a CSV file. Matches on email; a row with a
 * bad email or no name is skipped and reported, the rest still go in.
 */
export async function importPeople(ctx: Ctx, csv: string): Promise<ImportResult> {
  assertCan(ctx.actor, "manageDirectory");
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new DomainError("invalid", "The file needs a header row and at least one person.", "file");
  if (rows.length - 1 > MAX_IMPORT_ROWS) throw new DomainError("invalid", `Import up to ${MAX_IMPORT_ROWS.toLocaleString("en")} people at a time.`, "file");

  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const keys = await customKeys(tx);
      const columns = mapHeaders(rows[0], keys);
      if (!columns.includes("email")) throw new DomainError("invalid", "The file needs an Email column.", "file");
      const result: ImportResult = { added: 0, updated: 0, skipped: [] };
      const seen = new Set<string>();
      const existingByEmail = new Map(
        (await tx.person.findMany({ select: { id: true, email: true, custom: true } })).map((p) => [p.email, p] as const),
      );
      const fresh: (ReturnType<typeof clean> & { organisationId: string; source: "CSV" })[] = [];
      for (let r = 1; r < rows.length; r++) {
        const input: PersonInput & Record<string, unknown> = { email: "", firstName: "", custom: {} };
        let name = "";
        columns.forEach((col, i) => {
          const v = rows[r][i] ?? "";
          if (!col) return;
          if (col === "name") name = v;
          else if (col.startsWith("custom.")) input.custom![col.slice(7)] = v;
          else (input as Record<string, unknown>)[col] = v;
        });
        if (!input.firstName && name.trim()) {
          const parts = name.trim().split(/\s+/);
          input.firstName = parts[0];
          input.lastName ||= parts.slice(1).join(" ");
        }
        let data: ReturnType<typeof clean>;
        try {
          data = clean(input, keys);
        } catch (e) {
          if (e instanceof DomainError) {
            result.skipped.push({ row: r + 1, reason: e.message });
            continue;
          }
          throw e;
        }
        if (seen.has(data.email)) {
          result.skipped.push({ row: r + 1, reason: "This email appears earlier in the file." });
          continue;
        }
        seen.add(data.email);
        const existing = existingByEmail.get(data.email);
        if (existing) {
          const custom = { ...((existing.custom as Record<string, string>) ?? {}), ...data.custom };
          await tx.person.update({ where: { id: existing.id }, data: { ...data, custom } });
          result.updated++;
        } else {
          fresh.push({ ...data, organisationId: ctx.organisationId, source: "CSV" });
        }
      }
      for (let i = 0; i < fresh.length; i += 500) await tx.person.createMany({ data: fresh.slice(i, i + 500) });
      result.added = fresh.length;
      await audit(tx, ctx.organisationId, who(ctx.actor), "directory.imported", { type: "Organisation", id: ctx.organisationId }, {
        added: result.added,
        updated: result.updated,
        skipped: result.skipped.length,
      }, ctx.ipAddress);
      return result;
    },
    ctx.db,
    { timeout: 120_000 },
  );
}

// ─── For rendering ─────────────────────────────────────────────────

type PersonWithPhoto = Person & { photo: { id: string; contentType: string; width: number; height: number } | null };

export const PHOTO_SELECT = { photo: { select: { id: true, contentType: true, width: true, height: true } } } as const;

export function toPersonData(p: PersonWithPhoto, origin: string): PersonData {
  const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries((p.custom ?? {}) as Record<string, unknown>)) if (typeof v === "string") custom[k] = v;
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    title: p.title,
    department: p.department,
    phone: p.phone,
    mobile: p.mobile,
    photo: imageRef(origin, p.photo),
    custom,
  };
}

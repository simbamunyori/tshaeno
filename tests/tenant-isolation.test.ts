/**
 * Row-level security: one organisation can never see or change another's
 * rows, whatever the application code asks for. Needs DATABASE_URL (as
 * the tshaeno_app role) pointing at a migrated database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystem, asTenant, asUser } from "../src/server/db";
import { db, dbUrl, newOwner, testDeps } from "./helpers";

describe.skipIf(!dbUrl)("tenant isolation", () => {
  const deps = testDeps();
  let a: Awaited<ReturnType<typeof newOwner>>;
  let b: Awaited<ReturnType<typeof newOwner>>;

  beforeAll(async () => {
    a = await newOwner(deps, "Alpha");
    b = await newOwner(deps, "Bravo");
  });
  afterAll(() => db.$disconnect());

  it("connects as a role that can't bypass row-level security", async () => {
    const [role] = await db.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    const owned = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user`;
    expect(Number(owned[0].n)).toBe(0);
  });

  it("protects every table that holds tenant data", async () => {
    const tables = await db.$queryRaw<{ table: string; rls: boolean; forced: boolean }[]>`
      SELECT c.relname AS table, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relkind = 'r'
        AND (c.relname = 'Organisation' OR EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'organisationId'))
      ORDER BY 1`;
    expect(tables.map((t) => t.table)).toEqual(expect.arrayContaining(["AuditLog", "Invitation", "Membership", "Organisation"]));
    for (const t of tables) expect(t, t.table).toMatchObject({ rls: true, forced: true });
  });

  it("shows no tenant rows without a scope", async () => {
    expect(await db.organisation.count()).toBe(0);
    expect(await db.membership.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
    expect(await db.$queryRaw<unknown[]>`SELECT * FROM "Membership"`).toEqual([]);
  });

  it("reads only the open organisation's rows", async () => {
    await asTenant(a.organisationId, async (tx) => {
      const orgs = await tx.organisation.findMany();
      expect(orgs.map((o) => o.id)).toEqual([a.organisationId]);
      expect(await tx.organisation.findUnique({ where: { id: b.organisationId } })).toBeNull();
      const members = await tx.membership.findMany();
      expect(members.every((m) => m.organisationId === a.organisationId)).toBe(true);
      expect(await tx.membership.count({ where: { organisationId: b.organisationId } })).toBe(0);
      expect(await tx.auditLog.count({ where: { organisationId: b.organisationId } })).toBe(0);
      expect(await tx.auditLog.count()).toBeGreaterThan(0);
      const raw = await tx.$queryRaw<{ organisationId: string }[]>`SELECT "organisationId" FROM "Membership"`;
      expect(new Set(raw.map((r) => r.organisationId))).toEqual(new Set([a.organisationId]));
    });
  });

  it("refuses to write into another organisation", async () => {
    await expect(
      asTenant(a.organisationId, (tx) => tx.membership.create({ data: { organisationId: b.organisationId, userId: a.userId, role: "OWNER" } })),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asTenant(a.organisationId, (tx) =>
        tx.auditLog.create({ data: { organisationId: b.organisationId, actorLabel: "x", action: "x", entityType: "x", entityId: "x" } }),
      ),
    ).rejects.toThrow(/row-level security/);
    const renamed = await asTenant(a.organisationId, (tx) => tx.organisation.updateMany({ where: { id: b.organisationId }, data: { name: "Taken" } }));
    expect(renamed.count).toBe(0);
    const removed = await asTenant(a.organisationId, (tx) => tx.invitation.deleteMany({ where: { organisationId: b.organisationId } }));
    expect(removed.count).toBe(0);
  });

  it("refuses to move a row into another organisation", async () => {
    await expect(
      asTenant(a.organisationId, (tx) => tx.membership.updateMany({ where: { userId: a.userId }, data: { organisationId: b.organisationId } })),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets a person see only their own memberships across organisations", async () => {
    await asUser(a.userId, async (tx) => {
      const mine = await tx.membership.findMany({ include: { organisation: true } });
      expect(mine.map((m) => m.organisationId)).toEqual([a.organisationId]);
      expect(mine[0].organisation.id).toBe(a.organisationId);
      expect(await tx.auditLog.count()).toBe(0);
      expect(await tx.invitation.count()).toBe(0);
    });
  });

  it("never carries a scope over to the next transaction on the same connection", async () => {
    for (let i = 0; i < 5; i++) {
      await asTenant(a.organisationId, (tx) => tx.membership.count());
      expect(await db.membership.count()).toBe(0);
    }
  });

  it("sees everything only in system scope", async () => {
    const n = await asSystem((tx) => tx.organisation.count({ where: { id: { in: [a.organisationId, b.organisationId] } } }));
    expect(n).toBe(2);
  });

  it("keeps the audit log append-only, even for the open organisation", async () => {
    await expect(asTenant(a.organisationId, (tx) => tx.auditLog.updateMany({ data: { action: "rewritten" } }))).rejects.toThrow(/append-only/);
    await expect(asTenant(a.organisationId, (tx) => tx.auditLog.deleteMany())).rejects.toThrow(/append-only/);
  });
});

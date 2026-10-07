/**
 * The platform admin area for Tshaeno staff. Needs DATABASE_URL.
 */
import { afterAll, describe, expect, it } from "vitest";
import { asSystem, asTenant } from "../src/server/db";
import { listOrganisations, setOrganisationStatus } from "../src/server/platform/service";
import { db, dbUrl, newOwner, testDeps } from "./helpers";

describe.skipIf(!dbUrl)("platform admin", () => {
  const deps = testDeps();
  afterAll(() => db.$disconnect());

  it("is closed to everyone who isn't staff", async () => {
    const owner = await newOwner(deps);
    await expect(listOrganisations({ userId: owner.userId, name: "Neo", isPlatformAdmin: false }, "", db)).rejects.toThrow(/staff/);
  });

  it("suspends and resumes an organisation with a reason, in both logs", async () => {
    const owner = await newOwner(deps, "Suspend Me");
    const staff = { userId: owner.userId, name: "Staff Person", isPlatformAdmin: true };
    await expect(setOrganisationStatus(staff, owner.organisationId, "SUSPENDED", " ", null, db)).rejects.toThrow(/Say why/);
    await setOrganisationStatus(staff, owner.organisationId, "SUSPENDED", "Unpaid invoice", null, db);
    const org = await asSystem((tx) => tx.organisation.findUniqueOrThrow({ where: { id: owner.organisationId } }), db);
    expect(org.status).toBe("SUSPENDED");
    await setOrganisationStatus(staff, owner.organisationId, "ACTIVE", "Paid", null, db);
    const log = await asTenant(owner.organisationId, (tx) => tx.auditLog.findMany({ where: { action: { startsWith: "organisation.s" } } }));
    expect(log).toEqual([expect.objectContaining({ action: "organisation.suspended", actorLabel: "Tshaeno staff: Staff Person" })]);
    const platform = await db.platformAuditLog.findMany({ where: { targetOrganisationId: owner.organisationId } });
    expect(platform.map((p) => p.action).sort()).toEqual(["platform.organisation.resumed", "platform.organisation.suspended"]);
  });
});

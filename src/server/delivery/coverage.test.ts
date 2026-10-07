import { describe, expect, it } from "vitest";
import { coverageOf } from "./coverage";

const now = new Date("2026-10-07T12:00:00Z");
const base = { hasRule: true, inGoogle: true, googlePush: true, addinDeployed: false };

describe("coverageOf", () => {
  it("says why someone has no signature", () => {
    expect(coverageOf({ ...base, hasRule: false }, now)).toMatchObject({ status: "missing", reason: "No signature rule covers them." });
    expect(coverageOf({ ...base, inGoogle: false, googlePush: false }, now).reason).toBe("Connect Google Workspace or deploy the Outlook add-in.");
    expect(coverageOf({ ...base, inGoogle: false }, now).reason).toMatch(/Not in your Google directory/);
    expect(coverageOf({ ...base, inGoogle: false, addinDeployed: true }, now)).toMatchObject({ status: "missing", outlook: "Not seen yet" });
  });

  it("follows Gmail's state", () => {
    expect(coverageOf({ ...base, gmail: { state: "APPLIED", lastError: null } }, now)).toMatchObject({ status: "covered", gmail: "Set" });
    expect(coverageOf({ ...base, gmail: { state: "PENDING", lastError: null } }, now)).toMatchObject({ status: "waiting", reason: "Waiting to be set in Gmail." });
    expect(coverageOf({ ...base, gmail: { state: "FAILED", lastError: "Google doesn't recognise x." } }, now)).toMatchObject({
      status: "problem",
      reason: "Google doesn't recognise x.",
    });
  });

  it("counts Outlook only when the add-in ran recently", () => {
    const recent = { state: "APPLIED" as const, appliedAt: new Date("2026-10-01T00:00:00Z") };
    const old = { state: "APPLIED" as const, appliedAt: new Date("2026-08-01T00:00:00Z") };
    const outlookOnly = { ...base, inGoogle: false, googlePush: false, addinDeployed: true };
    expect(coverageOf({ ...outlookOnly, outlook: recent }, now)).toMatchObject({ status: "covered", outlook: "Working", gmail: null });
    expect(coverageOf({ ...outlookOnly, outlook: old }, now)).toMatchObject({ status: "missing", outlook: "Not seen yet" });
  });
});

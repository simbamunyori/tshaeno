import { describe, expect, it } from "vitest";
import { assignableRoles, can } from "./access";

describe("roles", () => {
  it("gives each role what the plan says", () => {
    expect(can({ role: "OWNER" }, "manageBilling")).toBe(true);
    expect(can({ role: "ADMIN" }, "manageBilling")).toBe(false);
    expect(can({ role: "ADMIN" }, "manageMembers")).toBe(true);
    expect(can({ role: "TEMPLATE_MANAGER" }, "manageTemplates")).toBe(true);
    expect(can({ role: "TEMPLATE_MANAGER" }, "manageMembers")).toBe(false);
    expect(can({ role: "ANALYST" }, "viewAnalytics")).toBe(true);
    expect(can({ role: "ANALYST" }, "manageTemplates")).toBe(false);
    expect(can({ role: "READ_ONLY" }, "view")).toBe(true);
    expect(can({ role: "READ_ONLY" }, "manageOrganisation")).toBe(false);
  });

  it("lets only owners hand out the owner role", () => {
    expect(assignableRoles({ role: "OWNER" })).toContain("OWNER");
    expect(assignableRoles({ role: "ADMIN" })).not.toContain("OWNER");
    expect(assignableRoles({ role: "ANALYST" })).toEqual([]);
  });
});

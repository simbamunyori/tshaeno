import { describe, expect, it } from "vitest";
import { healthScore } from "./health";

const base = { people: 10, covered: 10, problems: 0, missing: 0, applied: 40, failed: 0, connected: true, syncedRecently: true, brandWarnings: 0 };

describe("health score", () => {
  it("is full marks when everyone has a working, on-brand signature", () => {
    expect(healthScore(base)).toEqual({ score: 100, grade: "good", tips: [] });
  });

  it("weighs coverage most, and says what to fix first", () => {
    const h = healthScore({ ...base, covered: 6, missing: 4 });
    expect(h.score).toBe(76);
    expect(h.grade).toBe("fair");
    expect(h.tips[0]).toMatch(/^4 people have no signature yet/);
  });

  it("counts failures, a missing directory and brand issues", () => {
    const h = healthScore({ ...base, covered: 9, problems: 1, applied: 9, failed: 1, connected: false, brandWarnings: 2 });
    expect(h.score).toBe(54 + 18 + 0 + 5);
    expect(h.tips).toHaveLength(3);
    expect(h.tips.join(" ")).toMatch(/1 signature couldn't be applied/);
    expect(h.tips.join(" ")).toMatch(/Connect Google Workspace/);
  });

  it("starts at zero with nobody in the directory", () => {
    expect(healthScore({ ...base, people: 0, covered: 0 })).toMatchObject({ score: 0, grade: "poor" });
  });
});

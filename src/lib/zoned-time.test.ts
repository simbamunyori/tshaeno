import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "./zoned-time";

describe("dates in the organisation's time zone", () => {
  it("reads a form's date and time on the organisation's clock", () => {
    expect(fromLocalInput("2026-10-12T08:00", "Africa/Gaborone")?.toISOString()).toBe("2026-10-12T06:00:00.000Z");
    expect(fromLocalInput("2026-10-12T08:00", "UTC")?.toISOString()).toBe("2026-10-12T08:00:00.000Z");
    expect(fromLocalInput("2026-07-01T09:30", "Europe/London")?.toISOString()).toBe("2026-07-01T08:30:00.000Z");
    expect(fromLocalInput("", "UTC")).toBeNull();
    expect(fromLocalInput("tomorrow", "UTC")).toBeNull();
  });

  it("writes an instant back the same way", () => {
    expect(toLocalInput(new Date("2026-10-12T06:00:00Z"), "Africa/Gaborone")).toBe("2026-10-12T08:00");
    expect(toLocalInput(null, "UTC")).toBe("");
  });
});

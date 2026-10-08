import { describe, expect, it } from "vitest";
import { describeRule, resolveAssignments, signatureFor, type Rule } from "./rules";

let t = 0;
const rule = (templateId: string, over: Partial<Rule> = {}): Rule => ({
  templateId,
  scope: "EVERYONE",
  department: null,
  groupName: null,
  location: null,
  personId: null,
  forNew: true,
  forReply: true,
  audience: "ANY",
  createdAt: new Date(2026, 0, 1, 0, 0, t++),
  ...over,
});

const lesedi = { id: "p1", department: "Operations", location: "Gaborone", groups: ["Sales Team", "All Staff"] };
const newExternal = { compose: "new", audience: "external" } as const;

describe("signatureFor", () => {
  it("prefers person, then group, department, office, everyone", () => {
    const rules = [rule("everyone"), rule("office", { scope: "LOCATION", location: "gaborone" }), rule("dept", { scope: "DEPARTMENT", department: "operations " })];
    expect(signatureFor(lesedi, rules, newExternal)).toBe("dept");
    rules.push(rule("group", { scope: "GROUP", groupName: "SALES TEAM" }));
    expect(signatureFor(lesedi, rules, newExternal)).toBe("group");
    rules.push(rule("mine", { scope: "PERSON", personId: "p1" }));
    expect(signatureFor(lesedi, rules, newExternal)).toBe("mine");
    expect(signatureFor({ id: "p2", department: "", location: "", groups: [] }, rules, newExternal)).toBe("everyone");
  });

  it("chooses by recipients and by new or reply", () => {
    const rules = [
      rule("any"),
      rule("internal", { audience: "INTERNAL" }),
      rule("short-reply", { forNew: false, audience: "EXTERNAL" }),
    ];
    expect(signatureFor(lesedi, rules, newExternal)).toBe("any");
    expect(signatureFor(lesedi, rules, { compose: "new", audience: "internal" })).toBe("internal");
    expect(signatureFor(lesedi, rules, { compose: "reply", audience: "external" })).toBe("short-reply");
    expect(signatureFor(lesedi, rules, { compose: "reply", audience: "internal" })).toBe("internal");
  });

  it("lets a more specific rule win even against a recipient rule, and the newest among equals", () => {
    const rules = [rule("internal-everyone", { audience: "INTERNAL" }), rule("dept-any", { scope: "DEPARTMENT", department: "Operations" })];
    expect(signatureFor(lesedi, rules, { compose: "new", audience: "internal" })).toBe("dept-any");
    const older = rule("older");
    const newer = rule("newer");
    expect(signatureFor(lesedi, [older, newer], newExternal)).toBe("newer");
  });

  it("matches nobody on an empty department or office", () => {
    const rules = [rule("blank-dept", { scope: "DEPARTMENT", department: "" }), rule("blank-office", { scope: "LOCATION", location: "" })];
    expect(signatureFor({ id: "x", department: "", location: "" }, rules, newExternal)).toBeNull();
  });
});

describe("resolveAssignments", () => {
  it("gives the external signatures and every option", () => {
    const rules = [rule("everyone"), rule("internal", { audience: "INTERNAL" }), rule("replies", { scope: "PERSON", personId: "p1", forNew: false })];
    expect(resolveAssignments(lesedi, rules)).toEqual({ newEmail: "everyone", reply: "replies", all: ["replies", "internal", "everyone"] });
  });
});

describe("describeRule", () => {
  it("reads plainly", () => {
    expect(describeRule(rule("x", { scope: "GROUP", groupName: "Sales Team", forReply: false, audience: "EXTERNAL" }))).toEqual({
      who: "Members of Sales Team",
      when: "for new emails to people outside",
    });
    expect(describeRule(rule("x", { scope: "LOCATION", location: "Francistown", audience: "INTERNAL" })).who).toBe("Everyone at Francistown");
  });
});

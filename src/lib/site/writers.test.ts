import { describe, expect, it } from "vitest";
import { GUIDES } from "./guides";
import { INDUSTRY_SOLUTIONS } from "./solutions";
import { TEAM_SOLUTIONS } from "./teams";
import { INDUSTRIES } from "@/lib/signature/starters";
import { industrySlug } from "./nav";
import { disclaimer, outOfOffice } from "./writers";

const base = { name: "Lesego Molefe", back: "Monday 3 November", cover: "Kagiso", coverEmail: "kagiso@example.com", urgent: "+267 390 0000", company: "Northgate" };

describe("site writers", () => {
  it("writes an out-of-office reply with the return date and who to contact", () => {
    const t = outOfOffice({ ...base, reason: "leave", tone: "formal" });
    expect(t).toContain("I am on annual leave and back in the office on Monday 3 November.");
    expect(t).toContain("please contact Kagiso at kagiso@example.com");
    expect(t).toContain("+267 390 0000");
    expect(t.trim().endsWith("Northgate")).toBe(true);
  });

  it("leaves out what wasn't filled in", () => {
    const t = outOfOffice({ ...base, cover: "", coverEmail: "", urgent: "", back: "", reason: "holiday", tone: "warm" });
    expect(t).toContain("Our offices are closed for the public holiday.");
    expect(t).not.toContain("urgent");
    expect(t).not.toContain("looking after");
  });

  it("builds a disclaimer from the parts chosen, with the right privacy law", () => {
    const bw = disclaimer({ company: "Northgate (Pty) Ltd", registration: "BW00012345", country: "BW", parts: ["contract", "privacy"], licence: "" });
    expect(bw).toContain("binding agreement for Northgate (Pty) Ltd");
    expect(bw).toContain("Botswana Data Protection Act");
    expect(bw).toContain("Northgate (Pty) Ltd, registered in Botswana, company number BW00012345.");
    const za = disclaimer({ company: "Northgate", registration: "", country: "ZA", parts: ["privacy", "regulated"], licence: "an authorised financial services provider, FSP 123." });
    expect(za).toContain("POPIA");
    expect(za).toContain("An authorised financial services provider, FSP 123.");
    expect(za).not.toContain("..");
  });

  it("keeps the website's own copy free of exclamation marks and long dashes", () => {
    const all = JSON.stringify([GUIDES, INDUSTRY_SOLUTIONS, TEAM_SOLUTIONS]);
    expect(all).not.toMatch(/[!—–]/);
  });

  it("has a solutions page for every industry in the menu", () => {
    const slugs = new Set(INDUSTRY_SOLUTIONS.map((s) => s.slug));
    for (const i of INDUSTRIES) expect(slugs.has(industrySlug(i))).toBe(true);
  });
});

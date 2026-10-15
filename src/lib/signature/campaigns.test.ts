import { describe, expect, it } from "vitest";
import { campaignFor, campaignState, withBanner, type CampaignRule } from "./campaigns";

const now = new Date("2026-10-10T09:00:00Z");
const day = 86_400_000;
const rule = (over: Partial<CampaignRule> & { id: string }): CampaignRule => ({
  scope: "EVERYONE",
  department: null,
  groupName: null,
  location: null,
  audience: "EXTERNAL",
  forNew: true,
  forReply: false,
  startsAt: new Date(now.getTime() - day),
  endsAt: null,
  pausedAt: null,
  ...over,
});
const lesedi = { id: "p1", department: "Sales", location: "Gaborone", groups: ["Leaders"] };
const external = { compose: "new", audience: "external" } as const;

describe("campaign banners", () => {
  it("knows when a campaign runs", () => {
    expect(campaignState(rule({ id: "a" }), now)).toBe("running");
    expect(campaignState(rule({ id: "a", startsAt: new Date(now.getTime() + day) }), now)).toBe("scheduled");
    expect(campaignState(rule({ id: "a", pausedAt: now }), now)).toBe("paused");
    expect(campaignState(rule({ id: "a", endsAt: now }), now)).toBe("ended");
  });

  it("picks the most specific running campaign that fits the email", () => {
    const all = [
      rule({ id: "everyone" }),
      rule({ id: "sales", scope: "DEPARTMENT", department: "sales" }),
      rule({ id: "later", scope: "GROUP", groupName: "leaders", startsAt: new Date(now.getTime() + day) }),
      rule({ id: "francistown", scope: "LOCATION", location: "Francistown" }),
    ];
    expect(campaignFor(lesedi, all, external, now)?.id).toBe("sales");
    expect(campaignFor({ ...lesedi, department: "" }, all, external, now)?.id).toBe("everyone");
    expect(campaignFor(lesedi, all, { compose: "reply", audience: "external" }, now)).toBeNull();
    expect(campaignFor(lesedi, all, { compose: "new", audience: "internal" }, now)).toBeNull();
    expect(campaignFor(lesedi, [rule({ id: "any", audience: "ANY", forReply: true })], { compose: "reply", audience: "internal" }, now)?.id).toBe("any");
  });

  it("prefers the newer of two equal campaigns", () => {
    const older = rule({ id: "older", startsAt: new Date(now.getTime() - 3 * day) });
    const newer = rule({ id: "newer" });
    expect(campaignFor(lesedi, [older, newer], external, now)?.id).toBe("newer");
  });

  it("adds the banner under the signature at its shape, linked", () => {
    const r = withBanner(
      { html: "<table><tr><td>Lesedi</td></tr></table>", text: "Lesedi" },
      { imageUrl: "https://app.example/i/a/x.png", imageWidth: 1200, imageHeight: 300, width: 480, alt: "Winter sale", href: "https://app.example/c/k/p.m" },
    );
    expect(r.html).toContain('<td>Lesedi</td>');
    expect(r.html).toContain('width="480" height="120" alt="Winter sale"');
    expect(r.html).toContain('<a href="https://app.example/c/k/p.m"');
    expect(r.text).toBe("Lesedi\n\nWinter sale: https://app.example/c/k/p.m");
  });
});

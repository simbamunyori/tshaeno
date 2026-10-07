/**
 * Campaign banners in signatures, their clicks, the reports page, and
 * Claude's help, against a real database with Claude stood in for.
 */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystem, asTenant } from "../src/server/db";
import type { Actor } from "../src/server/org/access";
import { draftTemplate, reviewBrand } from "../src/server/ai/signatures";
import type { Claude } from "../src/server/ai/claude";
import { analytics } from "../src/server/analytics/service";
import { campaignReports, campaignTick, clickUrl, endCampaign, recordClick, saveCampaign, setPaused, type CampaignInput } from "../src/server/campaigns/service";
import { GMAIL_CONTEXT } from "../src/server/delivery/gmail";
import { OrgRenderer } from "../src/server/delivery/renderer";
import { quickStart } from "../src/server/onboarding/service";
import { savePerson } from "../src/server/signatures/people";
import { db, dbUrl, newOwner, testDeps } from "./helpers";

process.env.TOTP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");

const ORIGIN = "https://app.tshaeno.test";
const DAY = 86_400_000;
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/** Claude, answering with whatever the test hands it. */
function fakeClaude(answer: unknown): Claude & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    model: "test",
    prompts,
    client: {
      messages: {
        create: (async (req: { messages: { content: string }[]; tool_choice: { name: string } }) => {
          prompts.push(req.messages[0].content);
          return { content: [{ type: "tool_use", id: "t", name: req.tool_choice.name, input: answer }] };
        }) as unknown as Claude["client"]["messages"]["create"],
      } as Claude["client"]["messages"],
    },
  };
}

describe.skipIf(!dbUrl)("campaigns, reports and Claude", () => {
  const deps = testDeps();
  let owner: Awaited<ReturnType<typeof newOwner>>;
  let actor: Actor;
  const ctx = () => ({ db, organisationId: owner.organisationId, actor });
  const orgId = () => owner.organisationId;
  const banner = () => sharp({ create: { width: 1200, height: 300, channels: 4, background: { r: 200, g: 60, b: 40, alpha: 1 } } }).png().toBuffer();
  const input = (over: Partial<CampaignInput> = {}): CampaignInput => ({
    name: "Winter sale",
    linkUrl: "https://kalahari.example/winter",
    alt: "Winter sale, 20% off freight",
    width: 480,
    startsAt: null,
    endsAt: null,
    scope: "EVERYONE",
    target: "",
    audience: "EXTERNAL",
    forNew: true,
    forReply: false,
    ...over,
  });
  const render = (email: string, now = new Date()) =>
    asTenant(orgId(), async (tx) => {
      const p = await tx.person.findFirstOrThrow({ where: { email }, include: { photo: { select: { id: true, contentType: true, width: true, height: true } } } });
      return new OrgRenderer(tx, orgId(), ORIGIN, now).render(p, GMAIL_CONTEXT);
    });
  let lesedi: string;

  beforeAll(async () => {
    owner = await newOwner(deps);
    const m = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { userId: owner.userId } }));
    actor = { membershipId: m.id, userId: owner.userId, name: "Neo Dube", role: "OWNER" };
    lesedi = (await savePerson(ctx(), null, { email: "lesedi@kalahari.example", firstName: "Lesedi", department: "Sales", title: "Sales lead" })).id;
    await savePerson(ctx(), null, { email: "kabo@kalahari.example", firstName: "Kabo", department: "Operations" });
    await quickStart(ctx(), "general-everyday");
  });
  afterAll(() => db.$disconnect());

  it("checks what a campaign needs", async () => {
    await expect(saveCampaign(ctx(), null, input(), null)).rejects.toMatchObject({ field: "file" });
    await expect(saveCampaign(ctx(), null, input({ linkUrl: "javascript:alert(1)" }), await banner())).rejects.toMatchObject({ field: "linkUrl" });
    await expect(saveCampaign(ctx(), null, input({ scope: "DEPARTMENT" }), await banner())).rejects.toMatchObject({ field: "target" });
    await expect(saveCampaign(ctx(), null, input({ endsAt: new Date(Date.now() - DAY) }), await banner())).rejects.toMatchObject({ field: "endsAt" });
    await expect(saveCampaign({ ...ctx(), actor: { ...actor, role: "ANALYST" } }, null, input(), await banner())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("adds a running campaign's banner, with a click link for each sender, to the people it targets", async () => {
    const c = await saveCampaign(ctx(), null, input({ scope: "DEPARTMENT", target: "sales" }), await banner());
    expect(c.startPushedAt).not.toBeNull();
    const out = await render("lesedi@kalahari.example");
    expect(out!.html).toContain(`href="${clickUrl(ORIGIN, c.key, lesedi)}"`);
    expect(out!.html).toContain('width="480" height="120" alt="Winter sale, 20% off freight"');
    expect((await render("kabo@kalahari.example"))!.html).not.toContain("/c/");

    await setPaused(ctx(), c.id, true);
    expect((await render("lesedi@kalahari.example"))!.html).not.toContain("/c/");
    await setPaused(ctx(), c.id, false);
    expect((await render("lesedi@kalahari.example"))!.html).toContain("/c/");
  });

  it("refreshes Gmail when a scheduled campaign starts and ends, once each", async () => {
    const start = new Date(Date.now() + DAY);
    const c = await saveCampaign(ctx(), null, input({ name: "Open day", alt: "Open day on Saturday", startsAt: start, endsAt: new Date(start.getTime() + DAY) }), await banner());
    expect(c.startPushedAt).toBeNull();
    expect(await campaignTick(new Date(), db)).not.toContain(orgId());
    expect(await campaignTick(new Date(start.getTime() + 1000), db)).toContain(orgId());
    expect(await campaignTick(new Date(start.getTime() + 2000), db)).not.toContain(orgId());
    expect(await campaignTick(new Date(start.getTime() + DAY + 1000), db)).toContain(orgId());
    // While it runs it is newer than the sales one, but less specific.
    expect((await render("lesedi@kalahari.example", new Date(start.getTime() + 1000)))!.html).toContain("Winter sale");
    expect((await render("kabo@kalahari.example", new Date(start.getTime() + 1000)))!.html).toContain("Open day on Saturday");
  });

  it("counts a click once a day per visitor, credits the sender, and ignores link scanners", async () => {
    const c = await asTenant(orgId(), (tx) => tx.campaign.findFirstOrThrow({ where: { name: "Winter sale" } }));
    const token = clickUrl(ORIGIN, c.key, lesedi).split("/").pop()!;
    const click = (over: Partial<Parameters<typeof recordClick>[0]> = {}, now = new Date()) =>
      recordClick({ key: c.key, token, ip: "196.45.10.1", userAgent: BROWSER, ...over }, db, now);
    expect(await click()).toBe("https://kalahari.example/winter");
    await click();
    await click({ userAgent: "Mozilla/5.0 (compatible; Barracuda Sentinel)" });
    await click({ method: "HEAD" });
    await click({ ip: "196.45.10.2", token: `${lesedi}.forgedforged` });
    await click({}, new Date(Date.now() + DAY));
    expect(await recordClick({ key: "nosuchcampaign", token: "", ip: null, userAgent: BROWSER }, db)).toBeNull();
    const clicks = await asTenant(orgId(), (tx) => tx.campaignClick.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "asc" } }));
    expect(clicks.map((k) => k.senderId)).toEqual([lesedi, null, lesedi]);

    const [report] = (await asTenant(orgId(), (tx) => campaignReports(tx))).filter((r) => r.campaign.id === c.id);
    expect(report).toMatchObject({ state: "running", clicks: 3, topSenders: [{ name: "Lesedi", clicks: 2 }] });
    expect(report.daily.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("ends a campaign at once", async () => {
    const c = await asTenant(orgId(), (tx) => tx.campaign.findFirstOrThrow({ where: { name: "Winter sale" } }));
    await endCampaign(ctx(), c.id);
    expect((await render("lesedi@kalahari.example"))!.html).not.toContain("Winter sale");
  });

  it("reports coverage, delivery, brand and a health score", async () => {
    const a = await asTenant(orgId(), (tx) => analytics(tx, orgId(), ORIGIN));
    expect(a.people).toBe(2);
    expect(a.coverage.missing).toBe(2);
    expect(a.detailed).toBe(false);
    expect(a.health.score).toBeLessThan(50);
    expect(a.health.tips[0]).toMatch(/2 people have no signature yet/);
    expect(a.departments.map((d) => d.name).sort()).toEqual(["Operations", "Sales"]);
    expect(a.campaigns.length).toBeGreaterThanOrEqual(2);
  });

  it("drafts a template with Claude, keeping it to what the studio can open", async () => {
    const answer = {
      name: "Calm and clear!",
      doc: {
        version: 1,
        width: 480,
        baseSize: 13,
        blocks: [
          { id: "n", type: "text", text: "{{name}}", size: "lg", bold: true, italic: false, colour: "primary", align: "left" },
          { id: "b", type: "banner", assetId: "made-up", width: 400, link: "", alt: "", align: "left" },
          { id: "c", type: "contacts", items: ["phone", "email"], layout: "stacked", labels: "icons", size: "sm", colour: "muted", accent: "secondary", align: "left" },
        ],
      },
    };
    const claude = fakeClaude(answer);
    await expect(draftTemplate(ctx(), { description: "short" }, claude)).rejects.toMatchObject({ field: "description" });
    const t = await draftTemplate(ctx(), { description: "Clean and simple, name in our navy, contacts underneath." }, claude);
    expect(t.name).toBe("Calm and clear.");
    const draft = t.draft as { blocks: { type: string; id: string }[] };
    expect(draft.blocks.map((b) => b.type)).toEqual(["text", "contacts"]);
    expect(draft.blocks[0].id).not.toBe("n");
    expect(claude.prompts[0]).toContain("Clean and simple");
    expect(claude.prompts[0]).not.toContain("lesedi@");

    await expect(draftTemplate(ctx(), { description: "Anything at all, please." }, fakeClaude({ name: "Bad", doc: { version: 2 } }))).rejects.toThrow(/didn't come out right/);
    await expect(draftTemplate(ctx(), { description: "Anything at all, please." }, null)).rejects.toThrow(/isn't set up/);
  });

  it("asks Claude for a brand review without repeating the automatic checks", async () => {
    const claude = fakeClaude({
      findings: [
        { severity: "warning", template: "Everyday", message: "The name is bold here — but not in the others!" },
        { severity: "note", template: "Nonexistent", message: "Something general." },
      ],
    });
    const findings = await reviewBrand(ctx(), claude);
    expect(findings[0].message).toBe("The name is bold here, but not in the others.");
    expect(findings[1].template).toBeNull();
    expect(claude.prompts[0]).toContain("Already found:");
    const logged = await asSystem((tx) => tx.auditLog.count({ where: { organisationId: orgId(), action: "brand.reviewed_by_claude" } }), db);
    expect(logged).toBe(1);
  });
});

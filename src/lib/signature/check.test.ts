import { describe, expect, it } from "vitest";
import { checkSignatureHtml } from "./check";

const rules = (html: string) => checkSignatureHtml(html).issues.map((i) => i.rule);

describe("checkSignatureHtml", () => {
  it("passes a plain table signature", () => {
    const r = checkSignatureHtml('<table><tr><td style="color:#333333">Name</td></tr></table>');
    expect(r.clients).toEqual({ outlook: "pass", gmail: "pass", apple: "pass" });
  });

  it("fails layouts Outlook can't draw", () => {
    expect(rules('<div style="display:flex;width:300px">a</div>')).toEqual(expect.arrayContaining(["flex", "div-layout"]));
    expect(checkSignatureHtml('<div style="display:grid">a</div>').clients.outlook).toBe("fail");
  });

  it("fails what Gmail strips", () => {
    const r = checkSignatureHtml('<style>td{color:red}</style><table><tr><td style="color:var(--x)">a</td></tr></table>');
    expect(r.clients.gmail).toBe("fail");
    expect(r.issues.map((i) => i.rule)).toEqual(expect.arrayContaining(["style-tag", "css-var"]));
  });

  it("checks images", () => {
    expect(rules('<img src="https://x.test/a.svg" width="1" height="1" alt="">')).toContain("svg");
    expect(rules('<img src="data:image/png;base64,AA" width="1" height="1" alt="">')).toContain("img-data");
    expect(rules('<img src="/a.png" width="1" height="1" alt="">')).toContain("img-relative");
    expect(rules('<img src="https://x.test/a.png" alt="">')).toContain("img-size");
    expect(rules('<img src="https://x.test/a.png" width="1" height="1">')).toContain("img-alt");
  });

  it("counts characters against Gmail's limit", () => {
    const r = checkSignatureHtml(`<table><tr><td>${"x".repeat(10_001)}</td></tr></table>`);
    expect(r.clients.gmail).toBe("fail");
    expect(r.issues.some((i) => i.rule === "gmail-length")).toBe(true);
  });

  it("judges text against the background it sits on", () => {
    expect(rules('<table><tr><td style="color:#ffffff">a</td></tr></table>')).toContain("light-contrast");
    expect(rules('<table><tr><td bgcolor="#0b7f78"><a href="https://x.test" style="color:#ffffff">Go</a></td></tr></table>')).not.toContain("light-contrast");
    expect(rules('<table><tr><td bgcolor="#ffffff"><span style="color:#fafafa">a</span></td></tr></table>')).toContain("bg-contrast");
  });

  it("refuses links mail clients won't open", () => {
    expect(rules('<a href="javascript:alert(1)">x</a>')).toContain("href");
    expect(rules('<a href="tel:+26771234567">x</a><a href="mailto:a@b.co">y</a>')).not.toContain("href");
  });
});

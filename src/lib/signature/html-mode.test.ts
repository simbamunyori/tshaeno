import { describe, expect, it } from "vitest";
import { SAMPLE_PERSON } from "./fields";
import { renderHtmlSignature, sanitizeSignatureHtml } from "./html-mode";
import { HTML_STARTER } from "./starters";
import { checkSignatureHtml } from "./check";
import type { BrandData } from "./types";

const brand: BrandData = {
  colours: { primary: "#0B7F78", secondary: "#2EC4B6", text: "#0B1F3A", muted: "#5A6472" },
  font: "arial",
  company: "Kalahari Freight",
  website: "kalaharifreight.co.bw",
  address: "",
  disclaimer: "",
  socials: [],
  logo: null,
};

describe("HTML mode", () => {
  it("removes scripts, handlers, frames and unsafe links", () => {
    const out = sanitizeSignatureHtml(
      `<table onclick="x()"><tr><td><script>alert(1)</script><iframe src="https://evil"></iframe>
       <a href="javascript:alert(1)">a</a><a href="https://ok.example">b</a>
       <img src="data:image/png;base64,AAAA"><img src="https://ok.example/i.png" width="10" height="10" alt="">
       <span style="background:url(javascript:alert(1))">c</span><style>td{color:red}</style><svg><circle/></svg></td></tr></table>`,
    );
    expect(out).not.toMatch(/script|onclick|iframe|javascript:|data:|<style|<svg|url\(/i);
    expect(out).toContain('href="https://ok.example"');
    expect(out).toContain('src="https://ok.example/i.png"');
    expect(out).toContain("<span>c</span>");
  });

  it("fills fields with escaped values, even inside links", () => {
    const person = { ...SAMPLE_PERSON, firstName: "<b>Bad</b>", custom: { site: "javascript:alert(1)" } };
    const { html } = renderHtmlSignature('<a href="{{custom.site}}">{{name}}</a> <a href="mailto:{{email}}">{{company}}</a>', { brand, person });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;Bad&lt;/b&gt; Molefe");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="mailto:lesedi@example.com"');
    expect(html).toContain("Kalahari Freight");
  });

  it("gives a plain-text version", () => {
    const { text } = renderHtmlSignature(HTML_STARTER, { brand, person: SAMPLE_PERSON });
    expect(text.split("\n")).toEqual(["Lesedi Molefe", "Head of Operations, Kalahari Freight", "+267 390 1234", "lesedi@example.com"]);
  });

  it("starts from HTML that passes every check", () => {
    const { html } = renderHtmlSignature(HTML_STARTER, { brand, person: SAMPLE_PERSON });
    expect(checkSignatureHtml(html).clients).toEqual({ outlook: "pass", gmail: "pass", apple: "pass" });
  });
});

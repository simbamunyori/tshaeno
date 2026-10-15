import { describe, expect, it } from "vitest";
import { withBadge } from "./badge";
import { cleanSocialUrl } from "./socials";

describe("people's social links", () => {
  it("accepts links on the network's own site, adding https", () => {
    expect(cleanSocialUrl("linkedin", "linkedin.com/in/lesedi")).toEqual({ url: "https://linkedin.com/in/lesedi" });
    expect(cleanSocialUrl("linkedin", "https://za.linkedin.com/in/lesedi")).toEqual({ url: "https://za.linkedin.com/in/lesedi" });
    expect(cleanSocialUrl("x", "http://twitter.com/kabo")).toEqual({ url: "https://twitter.com/kabo" });
    expect(cleanSocialUrl("whatsapp", "wa.me/26771234567")).toEqual({ url: "https://wa.me/26771234567" });
    expect(cleanSocialUrl("github", "  ")).toEqual({ url: "" });
  });

  it("refuses anything else", () => {
    for (const bad of ["https://linkedin.com.evil.example/in/x", "https://evil.example/linkedin.com", "javascript:alert(1)", "https://user:pw@linkedin.com/in/x", "https://linkedin.com/", "https://linkedin.com:8443/in/x"]) {
      expect(cleanSocialUrl("linkedin", bad), bad).toHaveProperty("error");
    }
  });
});

describe("the free plan's link", () => {
  it("sits under the signature without changing it", () => {
    const out = withBadge({ html: "<table><tr><td>Neo</td></tr></table>", text: "Neo" }, "https://tshaeno.com/?ref=signature&a=1");
    expect(out.html).toContain("<td><table><tr><td>Neo</td></tr></table></td>");
    expect(out.html).toContain('href="https://tshaeno.com/?ref=signature&amp;a=1"');
    expect(out.text).toBe("Neo\n\nSignature by Tshaeno: https://tshaeno.com/?ref=signature&a=1");
  });
});

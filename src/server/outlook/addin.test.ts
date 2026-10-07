import { DomUtils, parseDocument } from "htmlparser2";
import { describe, expect, it } from "vitest";
import { addinId, launchEventScript, manifestXml } from "./addin";

const KEY = "abcdefghijklmnopqrstuvwxyz012345";

describe("Outlook manifest", () => {
  const xml = manifestXml({ origin: "https://app.tshaeno.com", key: KEY, organisationId: "org_1", organisationName: "Kalahari & Sons <Ltd>" });
  const doc = parseDocument(xml, { xmlMode: true });
  const find = (name: string) => DomUtils.findAll((e) => e.name === name, doc.children);

  it("is well-formed, with the top-level elements in the order Office requires", () => {
    const root = DomUtils.findOne((e) => e.name === "OfficeApp", doc.children)!;
    const order = root.children.filter((c) => c.type === "tag").map((c) => (c as { name: string }).name);
    expect(order).toEqual([
      "Id",
      "Version",
      "ProviderName",
      "DefaultLocale",
      "DisplayName",
      "Description",
      "IconUrl",
      "HighResolutionIconUrl",
      "SupportUrl",
      "AppDomains",
      "Hosts",
      "Requirements",
      "FormSettings",
      "Permissions",
      "Rule",
      "DisableEntityHighlighting",
      "VersionOverrides",
    ]);
    expect(find("DisplayName")[0].attribs.DefaultValue).toBe("Signatures for Kalahari & Sons <Ltd>");
    expect(xml).toContain('DefaultValue="Signatures for Kalahari &amp; Sons &lt;Ltd&gt;"');
  });

  it("runs on new emails and when recipients change, with the organisation's own links", () => {
    expect(find("LaunchEvent").map((e) => [e.attribs.Type, e.attribs.FunctionName])).toEqual([
      ["OnNewMessageCompose", "onNewMessageComposeHandler"],
      ["OnMessageRecipientsChanged", "onMessageRecipientsChangedHandler"],
    ]);
    const urls = Object.fromEntries(find("bt:Url").map((e) => [e.attribs.id, e.attribs.DefaultValue]));
    expect(urls["JSRuntime.Url"]).toBe(`https://app.tshaeno.com/outlook/${KEY}/launchevent.js`);
    expect(urls["WebViewRuntime.Url"]).toBe(`https://app.tshaeno.com/outlook/${KEY}/commands.html`);
    for (const ref of find("Runtime").concat(find("FunctionFile"), find("Override"))) expect(urls[ref.attribs.resid], ref.attribs.resid).toBeDefined();
  });

  it("keeps the same add-in id for an organisation", () => {
    expect(addinId("org_1")).toBe(addinId("org_1"));
    expect(addinId("org_1")).not.toBe(addinId("org_2"));
    expect(addinId("org_1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("launch event script", () => {
  it("parses as plain ES5-style JavaScript and registers both handlers", () => {
    const script = launchEventScript("https://app.tshaeno.com", KEY);
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toMatch(/=>|\basync\b|\bawait\b|\bconst\b|\blet\b|`/);
    const associated: Record<string, unknown> = {};
    const Office = { actions: { associate: (name: string, fn: unknown) => (associated[name] = fn) }, onReady: () => {} };
    new Function("Office", "XMLHttpRequest", script)(Office, class {});
    expect(Object.keys(associated)).toEqual(["onNewMessageComposeHandler", "onMessageRecipientsChangedHandler"]);
  });

  it("puts in the signature, and always tells Outlook it's done", async () => {
    const script = launchEventScript("https://app.tshaeno.com", KEY);
    const handlers: Record<string, (e: { completed: () => void }) => void> = {};
    let requested = "";
    let set = "";
    let respond: (status: number, body: string) => void = () => {};
    class Xhr {
      status = 0;
      responseText = "";
      onload?: () => void;
      onerror?: () => void;
      open(_m: string, url: string) {
        requested = url;
      }
      send() {
        respond = (status, body) => {
          this.status = status;
          this.responseText = body;
          this.onload?.();
        };
      }
    }
    const ok = { status: "succeeded", value: [] as unknown[] };
    const item = {
      to: { getAsync: (cb: (r: unknown) => void) => cb({ ...ok, value: [{ emailAddress: "a@Client.example" }] }) },
      cc: { getAsync: (cb: (r: unknown) => void) => cb({ ...ok, value: [{ emailAddress: "b@kalahari.example" }] }) },
      bcc: { getAsync: (cb: (r: unknown) => void) => cb(ok) },
      getComposeTypeAsync: (cb: (r: unknown) => void) => cb({ status: "succeeded", value: { composeType: "reply" } }),
      disableClientSignatureAsync: (cb: () => void) => cb(),
      body: { setSignatureAsync: (html: string, _o: unknown, cb: () => void) => ((set = html), cb()) },
    };
    const Office = {
      AsyncResultStatus: { Succeeded: "succeeded" },
      CoercionType: { Html: "html" },
      context: { mailbox: { item, userProfile: { emailAddress: "lesedi@kalahari.example" } } },
      actions: { associate: (name: string, fn: (e: { completed: () => void }) => void) => (handlers[name] = fn) },
    };
    new Function("Office", "XMLHttpRequest", script)(Office, Xhr);

    let done = 0;
    handlers.onNewMessageComposeHandler({ completed: () => done++ });
    const url = new URL(requested);
    expect(url.pathname).toBe(`/api/outlook/${KEY}/signature`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ email: "lesedi@kalahari.example", compose: "reply", domains: "client.example,kalahari.example" });
    respond(200, JSON.stringify({ html: "<table><tr><td>Lesedi</td></tr></table>" }));
    expect(set).toContain("Lesedi");
    expect(done).toBe(1);

    handlers.onMessageRecipientsChangedHandler({ completed: () => done++ });
    respond(500, "oops");
    expect(done).toBe(2);
  });
});

import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { isLive } from "@/server/billing/live";
import { asSystem, asTenant } from "@/server/db";
import { escapeHtml } from "@/lib/signature/style";
import { DomainError, assertCan, type Actor } from "@/server/org/access";
import { audit } from "@/server/org/audit";
import { markFirstSignature, OrgRenderer } from "@/server/delivery/renderer";
import { PHOTO_SELECT } from "@/server/signatures/people";

/**
 * The Outlook add-in. Each organisation gets its own manifest, which its
 * Microsoft 365 admin deploys to everyone from the admin centre. When
 * someone starts an email, or changes who it is to, the add-in asks us for
 * their signature and puts it in. If we can't be reached, Outlook carries
 * on with no signature from us: it never blocks sending.
 */

/** Bump when the manifest changes, so Microsoft 365 offers the update. */
export const MANIFEST_VERSION = "1.0.0.0";

const KEY = /^[A-Za-z0-9_-]{32}$/;
export const isAddinKey = (k: string) => KEY.test(k);

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
}

export async function addinKey(ctx: Ctx): Promise<string> {
  assertCan(ctx.actor, "manageOrganisation");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const existing = await tx.outlookAddin.findFirst();
      if (existing) return existing.key;
      const created = await tx.outlookAddin.create({ data: { organisationId: ctx.organisationId, key: randomBytes(24).toString("base64url") } });
      await audit(tx, ctx.organisationId, { userId: ctx.actor.userId, name: ctx.actor.name }, "outlook.addin_created", { type: "OutlookAddin", id: created.id }, undefined, ctx.ipAddress);
      return created.key;
    },
    ctx.db,
  );
}

/**
 * A new key, for when a manifest went somewhere it shouldn't. The old
 * manifest stops working, so the admin must deploy the new one.
 */
export async function replaceAddinKey(ctx: Ctx): Promise<string> {
  assertCan(ctx.actor, "manageOrganisation");
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const existing = await tx.outlookAddin.findFirst();
      if (!existing) throw new DomainError("not-found", "There is no add-in to replace yet.");
      const key = randomBytes(24).toString("base64url");
      await tx.outlookAddin.update({ where: { id: existing.id }, data: { key } });
      await audit(tx, ctx.organisationId, { userId: ctx.actor.userId, name: ctx.actor.name }, "outlook.addin_key_replaced", { type: "OutlookAddin", id: existing.id }, undefined, ctx.ipAddress);
      return key;
    },
    ctx.db,
  );
}

/** A stable GUID for the organisation's add-in, so a new download updates the same add-in. */
export function addinId(organisationId: string): string {
  const h = createHash("sha256").update(`tshaeno-outlook:${organisationId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const x = (v: string) => escapeHtml(v);

export function manifestXml(opts: { origin: string; key: string; organisationId: string; organisationName: string }): string {
  const base = `${opts.origin}/outlook/${opts.key}`;
  const icon = (size: number) => `${opts.origin}/outlook/icon/${size}.png`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0" xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0" xsi:type="MailApp">
  <Id>${addinId(opts.organisationId)}</Id>
  <Version>${MANIFEST_VERSION}</Version>
  <ProviderName>Tshaeno</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="${x(`Signatures for ${opts.organisationName}`.slice(0, 125))}"/>
  <Description DefaultValue="Adds your organisation's email signature to new emails and replies."/>
  <IconUrl DefaultValue="${icon(64)}"/>
  <HighResolutionIconUrl DefaultValue="${icon(128)}"/>
  <SupportUrl DefaultValue="${opts.origin}/"/>
  <AppDomains>
    <AppDomain>${opts.origin}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Mailbox"/>
  </Hosts>
  <Requirements>
    <Sets>
      <Set Name="Mailbox" MinVersion="1.1"/>
    </Sets>
  </Requirements>
  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="${base}/commands.html"/>
        <RequestedHeight>250</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadWriteItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Edit"/>
  </Rule>
  <DisableEntityHighlighting>false</DisableEntityHighlighting>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides/1.1" xsi:type="VersionOverridesV1_1">
      <Requirements>
        <bt:Sets DefaultMinVersion="1.10">
          <bt:Set Name="Mailbox"/>
        </bt:Sets>
      </Requirements>
      <Hosts>
        <Host xsi:type="MailHost">
          <Runtimes>
            <Runtime resid="WebViewRuntime.Url">
              <Override type="javascript" resid="JSRuntime.Url"/>
            </Runtime>
          </Runtimes>
          <DesktopFormFactor>
            <FunctionFile resid="Commands.Url"/>
            <ExtensionPoint xsi:type="LaunchEvent">
              <LaunchEvents>
                <LaunchEvent Type="OnNewMessageCompose" FunctionName="onNewMessageComposeHandler"/>
                <LaunchEvent Type="OnMessageRecipientsChanged" FunctionName="onMessageRecipientsChangedHandler"/>
              </LaunchEvents>
              <SourceLocation resid="WebViewRuntime.Url"/>
            </ExtensionPoint>
          </DesktopFormFactor>
        </Host>
      </Hosts>
      <Resources>
        <bt:Images>
          <bt:Image id="Icon.16x16" DefaultValue="${icon(16)}"/>
          <bt:Image id="Icon.32x32" DefaultValue="${icon(32)}"/>
          <bt:Image id="Icon.80x80" DefaultValue="${icon(80)}"/>
        </bt:Images>
        <bt:Urls>
          <bt:Url id="Commands.Url" DefaultValue="${base}/commands.html"/>
          <bt:Url id="WebViewRuntime.Url" DefaultValue="${base}/commands.html"/>
          <bt:Url id="JSRuntime.Url" DefaultValue="${base}/launchevent.js"/>
        </bt:Urls>
      </Resources>
    </VersionOverrides>
  </VersionOverrides>
</OfficeApp>
`;
}

export function commandsHtml(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Tshaeno signatures</title>
    <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
    <script src="launchevent.js"></script>
  </head>
  <body></body>
</html>
`;
}

/**
 * The event handlers Outlook runs. Plain ES5 with callbacks, because
 * classic Outlook on Windows runs them in a limited JavaScript runtime.
 * Every path ends in event.completed(), so Outlook is never left waiting.
 */
export function launchEventScript(origin: string, key: string): string {
  return `/* Tshaeno signatures for Outlook. */
(function () {
  var ENDPOINT = ${JSON.stringify(`${origin}/api/outlook/${key}/signature`)};

  function finish(event) {
    try { event.completed(); } catch (e) {}
  }

  function recipients(item, done) {
    var fields = [item.to, item.cc, item.bcc].filter(function (f) { return f && f.getAsync; });
    var found = [];
    var left = fields.length;
    if (!left) return done(found);
    fields.forEach(function (field) {
      field.getAsync(function (r) {
        if (r.status === Office.AsyncResultStatus.Succeeded && r.value) {
          r.value.forEach(function (x) { if (x && x.emailAddress) found.push(x.emailAddress); });
        }
        left -= 1;
        if (left === 0) done(found);
      });
    });
  }

  function composeType(item, done) {
    if (!item.getComposeTypeAsync) return done("newMail");
    item.getComposeTypeAsync(function (r) {
      done(r.status === Office.AsyncResultStatus.Succeeded && r.value ? r.value.composeType : "newMail");
    });
  }

  function domainsOf(addresses) {
    var seen = {};
    var out = [];
    addresses.forEach(function (a) {
      var d = String(a).split("@").pop().toLowerCase();
      if (d && !seen[d]) { seen[d] = true; out.push(d); }
    });
    return out;
  }

  function apply(event) {
    var item, email;
    try {
      item = Office.context.mailbox.item;
      email = Office.context.mailbox.userProfile.emailAddress;
    } catch (e) {
      return finish(event);
    }
    composeType(item, function (type) {
      recipients(item, function (list) {
        var url = ENDPOINT + "?email=" + encodeURIComponent(email) +
          "&compose=" + (type === "newMail" ? "new" : "reply") +
          "&domains=" + encodeURIComponent(domainsOf(list).join(","));
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.timeout = 8000;
        xhr.onload = function () {
          var data = null;
          try { data = JSON.parse(xhr.responseText); } catch (e) {}
          if (xhr.status !== 200 || !data || !data.html) return finish(event);
          var set = function () {
            item.body.setSignatureAsync(data.html, { coercionType: Office.CoercionType.Html }, function () { finish(event); });
          };
          if (item.disableClientSignatureAsync) item.disableClientSignatureAsync(set);
          else set();
        };
        xhr.onerror = function () { finish(event); };
        xhr.ontimeout = function () { finish(event); };
        xhr.send();
      });
    });
  }

  if (typeof Office !== "undefined") {
    if (Office.onReady) Office.onReady(function () {});
    Office.actions.associate("onNewMessageComposeHandler", apply);
    Office.actions.associate("onMessageRecipientsChangedHandler", apply);
  }
})();
`;
}

// ─── Serving signatures ────────────────────────────────────────────

export interface AddinRequest {
  key: string;
  email: string;
  compose: "new" | "reply";
  /** The domains the email is addressed to. */
  domains: string[];
}

export type AddinAnswer = { html: string | null; reason?: string };

/** How often we note that the add-in ran for someone, at most. */
const SEEN_EVERY_MS = 30 * 60_000;

/**
 * The signature for one email being written in Outlook. Internal means
 * every recipient is at a domain the organisation's own people use; with
 * no recipients yet, it counts as external.
 */
export async function signatureForOutlook(req: AddinRequest, origin: string, db?: PrismaClient, now = new Date()): Promise<AddinAnswer | null> {
  if (!isAddinKey(req.key)) return null;
  const addin = await asSystem((tx) => tx.outlookAddin.findUnique({ where: { key: req.key }, select: { organisationId: true } }), db);
  if (!addin) return null;
  if (!(await asSystem((tx) => isLive(tx, addin.organisationId), db))) return { html: null, reason: "service-ended" };
  const email = req.email.trim().toLowerCase();
  return asTenant(
    addin.organisationId,
    async (tx) => {
      const person = await tx.person.findFirst({ where: { email }, include: { ...PHOTO_SELECT, deliveries: { where: { target: "OUTLOOK" } } } });
      if (!person || !person.active) return { html: null, reason: "not-in-directory" };
      const ownDomains = new Set(
        (await tx.person.findMany({ where: { active: true }, select: { email: true } })).map((p) => p.email.split("@").pop()!.toLowerCase()),
      );
      const domains = req.domains.map((d) => d.trim().toLowerCase()).filter(Boolean);
      const audience = domains.length > 0 && domains.every((d) => ownDomains.has(d)) ? "internal" : "external";
      const out = await new OrgRenderer(tx, addin.organisationId, origin).render(person, { compose: req.compose, audience });
      const seen = person.deliveries[0];
      if (!seen || !seen.appliedAt || now.getTime() - seen.appliedAt.getTime() > SEEN_EVERY_MS || seen.templateId !== (out?.templateId ?? null)) {
        await tx.signatureDelivery.upsert({
          where: { personId_target: { personId: person.id, target: "OUTLOOK" } },
          create: { organisationId: addin.organisationId, personId: person.id, target: "OUTLOOK", state: out ? "APPLIED" : "SKIPPED", templateId: out?.templateId ?? null, hash: out?.hash ?? null, appliedAt: now, lastError: out ? null : "No signature rule covers them." },
          update: { state: out ? "APPLIED" : "SKIPPED", templateId: out?.templateId ?? null, hash: out?.hash ?? null, appliedAt: now, lastError: out ? null : "No signature rule covers them." },
        });
        if (out) await markFirstSignature(tx, addin.organisationId, now);
      }
      return out ? { html: out.html } : { html: null, reason: "no-rule" };
    },
    db,
  );
}

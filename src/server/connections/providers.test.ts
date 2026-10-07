import { describe, expect, it } from "vitest";
import { FakeGoogle, FakeMicrosoft, TENANT } from "../../../tests/fakes";
import { parseServiceAccount } from "./google";
import { ProviderError } from "./http";
import { adminConsentUrl, newConsentFlow } from "./microsoft";

const ADMIN = "admin@kalahari.example";

function google() {
  const g = new FakeGoogle();
  g.users = [
    {
      id: "g1",
      primaryEmail: "lesedi@kalahari.example",
      name: { givenName: "Lesedi", familyName: "Molefe" },
      organizations: [{ title: "Head of Operations", department: "Operations", location: "Gaborone", primary: true }],
      phones: [
        { value: "+267 390 1234", type: "work" },
        { value: "+267 71 234 567", type: "mobile" },
      ],
      customSchemas: { Employee: { Pronouns: "she/her", CostCentre: 42 } },
    },
    { id: "g2", primaryEmail: "kabo@kalahari.example", name: { givenName: "Kabo" }, suspended: true },
    { id: "g3", primaryEmail: "neo@kalahari.example", name: { givenName: "Neo", familyName: "Dube" } },
  ];
  g.groups = [
    { email: "sales@kalahari.example", name: "Sales Team", members: ["lesedi@kalahari.example", "neo@kalahari.example"] },
    { email: "all@kalahari.example", name: "All Staff", members: ["lesedi@kalahari.example"] },
  ];
  return g;
}

describe("Google Workspace", () => {
  it("reads every page of users with their groups and attributes", async () => {
    const users = await google().client().listUsers(ADMIN);
    expect(users).toHaveLength(3);
    expect(users[0]).toEqual({
      externalId: "g1",
      email: "lesedi@kalahari.example",
      firstName: "Lesedi",
      lastName: "Molefe",
      title: "Head of Operations",
      department: "Operations",
      phone: "+267 390 1234",
      mobile: "+267 71 234 567",
      location: "Gaborone",
      groups: ["Sales Team", "All Staff"],
      active: true,
      attributes: { "Employee.Pronouns": "she/her", "Employee.CostCentre": "42" },
    });
    expect(users[1].active).toBe(false);
    expect(users[2].groups).toEqual(["Sales Team"]);
  });

  it("sets a Gmail signature acting as that person", async () => {
    const g = google();
    await g.client().setSignature("lesedi@kalahari.example", "<b>Hi</b>");
    expect(g.signatures.get("lesedi@kalahari.example")).toBe("<b>Hi</b>");
  });

  it("explains each kind of failure, and which are worth retrying", async () => {
    const g = google();
    g.allowed.delete("https://www.googleapis.com/auth/gmail.settings.basic");
    const err = await g.client().setSignature("lesedi@kalahari.example", "x").catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ kind: "access", retryable: false });
    expect(err.message).toContain("109876543210987654321");

    const unknown = await google().client().setSignature("nobody@kalahari.example", "x").catch((e) => e);
    expect(unknown).toMatchObject({ kind: "not-found" });

    const busy = google();
    busy.failNext = { count: 1, status: 503, message: "Backend Error" };
    expect(await busy.client().setSignature("lesedi@kalahari.example", "x").catch((e) => e)).toMatchObject({ kind: "unavailable", retryable: true });

    const notAdmin = await google().client().listUsers("lesedi@kalahari.example").catch((e) => e);
    expect(notAdmin).toMatchObject({ kind: "access" });
    expect(notAdmin.message).toMatch(/super admin/);
  });

  it("reports exactly what works", async () => {
    const g = google();
    g.allowed.delete("https://www.googleapis.com/auth/admin.directory.group.readonly");
    const health = await g.client().health(ADMIN);
    expect(health.map((h) => [h.key, h.ok])).toEqual([
      ["users", true],
      ["groups", false],
      ["gmail", true],
    ]);
    expect(health[1].message).toMatch(/Domain-wide delegation/);
  });

  it("reads the service account key as JSON or base64", () => {
    const raw = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", client_id: "123", private_key: "-----BEGIN PRIVATE KEY-----" });
    expect(parseServiceAccount(raw)?.clientId).toBe("123");
    expect(parseServiceAccount(Buffer.from(raw).toString("base64"))?.clientEmail).toBe("a@b.iam.gserviceaccount.com");
    expect(parseServiceAccount("nonsense")).toBeNull();
    expect(parseServiceAccount("")).toBeNull();
  });
});

describe("Microsoft 365", () => {
  function microsoft() {
    const m = new FakeMicrosoft();
    m.users = [
      { id: "m1", mail: "Lesedi@Kalahari.example", givenName: "Lesedi", surname: "Molefe", jobTitle: "Head of Operations", department: "Operations", officeLocation: "Gaborone", businessPhones: ["+267 390 1234"], mobilePhone: null, accountEnabled: true, onPremisesExtensionAttributes: { extensionAttribute3: "she/her", extensionAttribute4: null } },
      { id: "m2", mail: null, userPrincipalName: "kabo@kalahari.example", displayName: "Kabo Moremi", accountEnabled: false },
      { id: "m3", mail: "guest@other.example", userType: "Guest" },
    ];
    m.groups = [{ id: "grp1", displayName: "Sales Team", members: ["m1", "m2"] }];
    return m;
  }

  it("reads users across pages, skipping guests", async () => {
    const users = await microsoft().client().listUsers();
    expect(users.map((u) => u.email)).toEqual(["lesedi@kalahari.example", "kabo@kalahari.example"]);
    expect(users[0]).toMatchObject({ firstName: "Lesedi", location: "Gaborone", phone: "+267 390 1234", groups: ["Sales Team"], attributes: { extensionAttribute3: "she/her" } });
    expect(users[1]).toMatchObject({ firstName: "Kabo", lastName: "Moremi", active: false });
  });

  it("says when consent is missing or too narrow", async () => {
    const m = microsoft();
    m.consented.clear();
    expect((await m.client().health())[0]).toMatchObject({ key: "consent", ok: false });
    const narrow = microsoft();
    narrow.permissions.delete("GroupMember.Read.All");
    const health = await narrow.client().health();
    expect(health.map((h) => [h.key, h.ok])).toEqual([
      ["consent", true],
      ["users", true],
      ["groups", false],
    ]);
    expect(health[2].message).toMatch(/consent link again/);
  });

  it("builds the admin consent link as a sign-in with PKCE", () => {
    const flow = newConsentFlow();
    const url = new URL(adminConsentUrl({ clientId: "ms-client" }, "https://app.example/connect/microsoft/callback", flow));
    expect(url.pathname).toBe("/organizations/oauth2/v2.0/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "ms-client",
      response_type: "code",
      prompt: "admin_consent",
      state: flow.state,
      nonce: flow.nonce,
      code_challenge_method: "S256",
      redirect_uri: "https://app.example/connect/microsoft/callback",
    });
    expect(url.searchParams.get("code_challenge")).not.toBe(flow.verifier);
    expect(TENANT).toMatch(/^[0-9a-f-]{36}$/);
  });

  describe("redeeming consent", () => {
    const redirect = "https://app.example/connect/microsoft/callback";
    const signIn = async (m: FakeMicrosoft, flow = newConsentFlow()) => {
      const res = await m.fetch(adminConsentUrl({ clientId: "ms-client" }, redirect, flow, { login: "https://login.test", graph: "https://graph.test" }));
      return { flow, code: new URL(res.headers.get("location")!).searchParams.get("code")! };
    };

    it("takes the tenant from the signed id_token", async () => {
      const m = microsoft();
      m.signInTenant = "11111111-2222-4333-8444-555555555555";
      const { flow, code } = await signIn(m);
      expect(await m.redeemConsent(code, redirect, flow)).toEqual({ tenantId: "11111111-2222-4333-8444-555555555555", adminName: "Thato Ramotswe" });
    });

    it("works once, and only with the matching verifier", async () => {
      const m = microsoft();
      const { flow, code } = await signIn(m);
      await expect(m.redeemConsent(code, redirect, { ...flow, verifier: "wrong" })).rejects.toBeInstanceOf(ProviderError);
      const again = await signIn(m);
      await m.redeemConsent(again.code, redirect, again.flow);
      await expect(m.redeemConsent(again.code, redirect, again.flow)).rejects.toBeInstanceOf(ProviderError);
    });

    it("rejects a token with the wrong nonce, audience, issuer or signer", async () => {
      const m = microsoft();
      const forged = async (token: (nonce: string) => Promise<string>) => {
        const { flow, code } = await signIn(m);
        const realFetch = m.fetch;
        const f: typeof fetch = async (input, init) => (String(input).endsWith("/token") ? Response.json({ id_token: await token(flow.nonce) }) : realFetch(input, init));
        const { redeemConsent } = await import("./microsoft");
        return redeemConsent({ clientId: "ms-client", clientSecret: "ms-secret" }, code, redirect, flow, f, { login: "https://login.test", graph: "https://graph.test" }, m.keys);
      };
      expect((await forged((nonce) => m.idToken({ tenant: TENANT, nonce }))).tenantId).toBe(TENANT);
      await expect(forged(() => m.idToken({ tenant: TENANT, nonce: "other" }))).rejects.toThrow(/couldn't be verified/);
      await expect(forged((nonce) => m.idToken({ tenant: TENANT, nonce, aud: "someone-else" }))).rejects.toThrow(/couldn't be verified/);
      await expect(forged((nonce) => m.idToken({ tenant: TENANT, nonce, iss: "https://evil.example/v2.0" }))).rejects.toThrow(/couldn't be verified/);
      const { generateKeyPairSync } = await import("node:crypto");
      const other = microsoft();
      other.signingKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
      await expect(forged((nonce) => other.idToken({ tenant: TENANT, nonce }))).rejects.toThrow(/couldn't be verified/);
    });

    it("turns away personal Microsoft accounts", async () => {
      const m = microsoft();
      m.signInTenant = "9188040d-6c67-4c5b-b112-36a304b66dad";
      const { flow, code } = await signIn(m);
      await expect(m.redeemConsent(code, redirect, flow)).rejects.toThrow(/personal Microsoft account/);
    });
  });
});

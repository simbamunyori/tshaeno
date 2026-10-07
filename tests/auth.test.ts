/**
 * Signing up and in with a password, Google, Microsoft and the second
 * step. Needs DATABASE_URL.
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  AuthError,
  completeSignIn,
  getSession,
  linkIdentity,
  signInWithIdentity,
  startSignIn,
  unlinkIdentity,
  type SessionWithUser,
} from "../src/server/auth/service";
import { totpAt } from "../src/server/auth/totp";
import { asTenant } from "../src/server/db";
import { db, dbUrl, newOwner, tag, testDeps } from "./helpers";

describe.skipIf(!dbUrl)("sign-in", () => {
  const deps = testDeps();
  afterAll(() => db.$disconnect());

  it("signs up, sets up the authenticator and lands as owner, with an audit trail", async () => {
    const owner = await newOwner(deps);
    expect(owner.session.stage).toBe("ACTIVE");
    expect(owner.session.method).toBe("PASSWORD");
    const actions = await asTenant(owner.organisationId, (tx) => tx.auditLog.findMany({ orderBy: { createdAt: "asc" } }));
    expect(actions.map((a) => a.action)).toEqual(["organisation.created", "auth.authenticator_set_up", "auth.sign_in"]);
    const queued = await db.outboundEmail.findFirst({ where: { toAddress: owner.email, kind: "verify_email" } });
    expect(queued).not.toBeNull();
  });

  it("asks for the code after the password, and accepts each code once", async () => {
    const owner = await newOwner(deps);
    const { token, stage } = await startSignIn(deps, { email: owner.email, password: "correct horse battery staple" });
    expect(stage).toBe("CODE_PENDING");
    // The code used at setup can't be used again.
    const later = () => new Date(Date.now() + 30_000);
    const signedIn = await completeSignIn({ ...deps, now: later }, token, totpAt(owner.secret, later()));
    expect((await getSession(deps, signedIn.token))?.stage).toBe("ACTIVE");
    // The pending token is worthless now.
    expect(await getSession(deps, token)).toBeNull();
  });

  it("answers a wrong email and a wrong password the same way, and locks after five", async () => {
    const owner = await newOwner(deps);
    await expect(startSignIn(deps, { email: `nobody-${tag()}@example.com`, password: "x" })).rejects.toMatchObject({ code: "invalid-credentials" });
    for (let i = 0; i < 4; i++) {
      await expect(startSignIn(deps, { email: owner.email, password: "wrong password here" })).rejects.toMatchObject({ code: "invalid-credentials" });
    }
    await expect(startSignIn(deps, { email: owner.email, password: "wrong password here" })).rejects.toMatchObject({ code: "locked" });
    await expect(startSignIn(deps, { email: owner.email, password: "correct horse battery staple" })).rejects.toMatchObject({ code: "locked" });
  });

  it("creates a new person from Google with no organisation yet", async () => {
    const email = `new-${tag()}@gmail.com`;
    const r = await signInWithIdentity(deps, { provider: "GOOGLE", subject: `g-${tag()}`, email, emailVerified: true, name: "Lesedi K" });
    expect(r).toMatchObject({ stage: "ACTIVE", isNew: true });
    const s = await getSession(deps, r.token);
    expect(s?.activeOrganisationId).toBeNull();
    expect(s?.user.emailVerifiedAt).not.toBeNull();
    expect(s?.method).toBe("GOOGLE");
  });

  it("joins a verified Google email to the existing account, and then asks for the code", async () => {
    const owner = await newOwner(deps);
    const r = await signInWithIdentity(deps, { provider: "GOOGLE", subject: `g-${tag()}`, email: owner.email.toUpperCase(), emailVerified: true, name: "Neo" });
    expect(r).toMatchObject({ stage: "CODE_PENDING", isNew: false });
    expect(await db.identity.count({ where: { userId: owner.userId } })).toBe(1);
  });

  it("never joins a Microsoft account to an existing one by email", async () => {
    const owner = await newOwner(deps);
    const attempt = signInWithIdentity(deps, { provider: "MICROSOFT", subject: `t:${tag()}`, email: owner.email, emailVerified: false, name: "Neo" });
    await expect(attempt).rejects.toBeInstanceOf(AuthError);
    await expect(attempt).rejects.toMatchObject({ code: "link-required" });
    expect(await db.identity.count({ where: { userId: owner.userId } })).toBe(0);
  });

  it("links Microsoft from settings, signs in with it, and keeps the last way in", async () => {
    const owner = await newOwner(deps);
    const subject = `t:${tag()}`;
    await linkIdentity(deps, owner.session, { provider: "MICROSOFT", subject, email: "neo@contoso.example", emailVerified: false, name: "Neo" });
    const r = await signInWithIdentity(deps, { provider: "MICROSOFT", subject, email: "neo@contoso.example", emailVerified: false, name: "Neo" });
    expect(r.stage).toBe("CODE_PENDING");

    // Someone with only a Google sign-in can't remove it.
    const g = await signInWithIdentity(deps, { provider: "GOOGLE", subject: `g-${tag()}`, email: `only-${tag()}@gmail.com`, emailVerified: true, name: "Kabo" });
    const gs = (await getSession(deps, g.token)) as SessionWithUser;
    const identity = await db.identity.findFirstOrThrow({ where: { userId: gs.userId } });
    await expect(unlinkIdentity(deps, gs, identity.id)).rejects.toThrow(/only way to sign in/);
  });

  it("refuses to link an account that belongs to someone else", async () => {
    const one = await newOwner(deps);
    const two = await newOwner(deps);
    const subject = `g-${tag()}`;
    await linkIdentity(deps, one.session, { provider: "GOOGLE", subject, email: one.email, emailVerified: true, name: "x" });
    await expect(linkIdentity(deps, two.session, { provider: "GOOGLE", subject, email: one.email, emailVerified: true, name: "x" })).rejects.toThrow(
      /linked to someone else/,
    );
  });
});

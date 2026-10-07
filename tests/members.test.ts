/**
 * Inviting, changing and removing people, and the invitation email.
 * Needs DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptInvitationAsNewUser, getSession, lookupInvitation } from "../src/server/auth/service";
import { asTenant } from "../src/server/db";
import { drainOutbox } from "../src/server/mail/outbox";
import type { Message } from "../src/server/mail/transport";
import type { Actor } from "../src/server/org/access";
import { changeRole, inviteMember, removeMember, revokeInvitation } from "../src/server/org/members";
import { db, dbUrl, newOwner, tag, testDeps } from "./helpers";

describe.skipIf(!dbUrl)("team", () => {
  const deps = testDeps();
  let owner: Awaited<ReturnType<typeof newOwner>>;
  let actor: Actor;
  const sent: Message[] = [];
  const sender = async (m: Message) => void sent.push(m);

  beforeAll(async () => {
    owner = await newOwner(deps);
    const m = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { userId: owner.userId } }));
    actor = { membershipId: m.id, userId: owner.userId, name: "Neo Dube", role: "OWNER" };
  });
  afterAll(() => db.$disconnect());

  const ctx = () => ({ db, organisationId: owner.organisationId, actor });

  /** Sends the outbox and returns the link in the newest email to this address. */
  async function linkFor(email: string, path: string): Promise<string> {
    await drainOutbox(db, sender, 100);
    const message = sent.filter((m) => m.to === email).at(-1);
    const match = message?.text.match(new RegExp(`${path}/([A-Za-z0-9_-]+)`));
    if (!match) throw new Error(`No ${path} link for ${email}`);
    return match[1];
  }

  it("invites someone, who accepts with a password and joins with that role", async () => {
    const email = `admin-${tag()}@example.com`;
    await inviteMember(ctx(), { email, role: "ADMIN" });
    const token = await linkFor(email, "/invite");
    const found = await lookupInvitation(deps, token);
    expect(found.state).toBe("VALID");
    const { token: setup } = await acceptInvitationAsNewUser(deps, token, { name: "Kabo M", password: "another long passphrase" });
    expect((await getSession(deps, setup))?.stage).toBe("SETUP_PENDING");
    const members = await asTenant(owner.organisationId, (tx) => tx.membership.findMany({ include: { user: true } }));
    expect(members.find((m) => m.user.email === email)?.role).toBe("ADMIN");
    // A link works once.
    expect((await lookupInvitation(deps, token)).state).toBe("INVALID");
  });

  it("only lets the newest invitation email's link work, and a withdrawn one never", async () => {
    const email = `tm-${tag()}@example.com`;
    const inv = await inviteMember(ctx(), { email, role: "TEMPLATE_MANAGER" });
    const first = await linkFor(email, "/invite");
    await inviteMember(ctx(), { email, role: "ANALYST" });
    const second = await linkFor(email, "/invite");
    expect((await lookupInvitation(deps, first)).state).toBe("INVALID");
    expect((await lookupInvitation(deps, second)).state).toBe("VALID");
    await expect(revokeInvitation(ctx(), inv.id)).rejects.toThrow(/no longer open/);
  });

  it("stops an admin making owners or touching owners", async () => {
    const email = `admin2-${tag()}@example.com`;
    await inviteMember(ctx(), { email, role: "ADMIN" });
    const token = await linkFor(email, "/invite");
    await acceptInvitationAsNewUser(deps, token, { name: "Admin Two", password: "another long passphrase" });
    const admin = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { user: { email } } }));
    const adminActor: Actor = { membershipId: admin.id, userId: admin.userId, name: "Admin Two", role: "ADMIN" };
    const adminCtx = { db, organisationId: owner.organisationId, actor: adminActor };
    await expect(inviteMember(adminCtx, { email: `x-${tag()}@example.com`, role: "OWNER" })).rejects.toThrow(/Only an owner/);
    await expect(changeRole(adminCtx, actor.membershipId, "READ_ONLY")).rejects.toThrow();
    await expect(removeMember(adminCtx, actor.membershipId)).rejects.toThrow();
  });

  it("always keeps one owner", async () => {
    await expect(changeRole(ctx(), actor.membershipId, "ADMIN")).rejects.toThrow(/at least one owner/);
    await expect(removeMember(ctx(), actor.membershipId)).rejects.toThrow(/at least one owner/);
  });

  it("ends a removed person's sessions in the organisation and audits each change", async () => {
    const email = `ro-${tag()}@example.com`;
    await inviteMember(ctx(), { email, role: "READ_ONLY" });
    const token = await linkFor(email, "/invite");
    const { token: session } = await acceptInvitationAsNewUser(deps, token, { name: "Reader", password: "another long passphrase" });
    const member = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { user: { email } } }));
    await changeRole(ctx(), member.id, "ANALYST");
    await removeMember(ctx(), member.id);
    expect(await getSession(deps, session)).toBeNull();
    const log = await asTenant(owner.organisationId, (tx) => tx.auditLog.findMany({ where: { entityId: member.id }, orderBy: { createdAt: "asc" } }));
    expect(log.map((l) => l.action)).toEqual(["member.role_changed", "member.removed"]);
  });

  it("sends the confirm-email link with a fresh token", async () => {
    const link = await linkFor(owner.email, "/verify-email");
    expect(link.length).toBeGreaterThan(30);
    expect(await db.user.findUniqueOrThrow({ where: { id: owner.userId } }).then((u) => u.emailTokenHash)).not.toBeNull();
  });
});

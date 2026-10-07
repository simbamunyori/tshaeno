import type { PrismaClient, Role } from "@prisma/client";
import { asTenant, type Tx } from "@/server/db";
import { INVITATION_TTL_MS, looksLikeEmail, newLinkToken, normaliseEmail } from "@/server/auth/service";
import { DomainError, assertCan, assignableRoles, type Actor } from "./access";
import { audit } from "./audit";

/**
 * Inviting, changing and removing people. Everything runs inside the
 * organisation's own scope, so row-level security keeps it there.
 */

interface Ctx {
  db?: PrismaClient;
  organisationId: string;
  actor: Actor;
  ipAddress?: string | null;
  now?: Date;
}

const who = (actor: Actor) => ({ userId: actor.userId, name: actor.name });

function assertMayGive(actor: Actor, role: Role) {
  if (!assignableRoles(actor).includes(role)) {
    throw new DomainError("forbidden", role === "OWNER" ? "Only an owner can make someone an owner." : "You can't give that role.");
  }
}

/** Queues the invitation email. The link is made when it is sent. */
async function queueInvitationEmail(tx: Tx, invitationId: string, email: string) {
  await tx.outboundEmail.create({ data: { kind: "invitation", toAddress: email, payload: { invitationId } } });
}

export async function inviteMember(ctx: Ctx, input: { email: string; role: Role }) {
  assertCan(ctx.actor, "manageMembers");
  assertMayGive(ctx.actor, input.role);
  const email = normaliseEmail(input.email);
  if (!looksLikeEmail(email)) throw new DomainError("invalid", "Enter a valid email address.", "email");
  const now = ctx.now ?? new Date();
  return asTenant(
    ctx.organisationId,
    async (tx) => {
      const member = await tx.membership.findFirst({ where: { active: true, user: { email } }, select: { id: true } });
      if (member) throw new DomainError("conflict", "That person is already a member.", "email");
      // A newer invitation replaces any still waiting for the same address.
      await tx.invitation.updateMany({
        where: { email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: now, tokenHash: null },
      });
      const invitation = await tx.invitation.create({
        data: {
          organisationId: ctx.organisationId,
          email,
          role: input.role,
          // Placeholder until the email is sent; never matches a real link.
          tokenHash: newLinkToken().tokenHash,
          invitedById: ctx.actor.membershipId,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        },
      });
      await queueInvitationEmail(tx, invitation.id, email);
      await audit(tx, ctx.organisationId, who(ctx.actor), "member.invited", { type: "Invitation", id: invitation.id }, { email, role: input.role }, ctx.ipAddress);
      return invitation;
    },
    ctx.db,
  );
}

export async function resendInvitation(ctx: Ctx, invitationId: string) {
  assertCan(ctx.actor, "manageMembers");
  const now = ctx.now ?? new Date();
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const invitation = await tx.invitation.findFirst({ where: { id: invitationId, acceptedAt: null, revokedAt: null } });
      if (!invitation) throw new DomainError("not-found", "That invitation is no longer open.");
      assertMayGive(ctx.actor, invitation.role);
      await tx.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) } });
      await queueInvitationEmail(tx, invitation.id, invitation.email);
      await audit(tx, ctx.organisationId, who(ctx.actor), "member.invitation_resent", { type: "Invitation", id: invitation.id }, { email: invitation.email }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function revokeInvitation(ctx: Ctx, invitationId: string) {
  assertCan(ctx.actor, "manageMembers");
  const now = ctx.now ?? new Date();
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const invitation = await tx.invitation.findFirst({ where: { id: invitationId, acceptedAt: null, revokedAt: null } });
      if (!invitation) throw new DomainError("not-found", "That invitation is no longer open.");
      assertMayGive(ctx.actor, invitation.role);
      await tx.invitation.update({ where: { id: invitation.id }, data: { revokedAt: now, tokenHash: null } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "member.invitation_revoked", { type: "Invitation", id: invitation.id }, { email: invitation.email }, ctx.ipAddress);
    },
    ctx.db,
  );
}

/** An organisation always keeps at least one active owner. */
async function assertOwnerRemains(tx: Tx, leavingMembershipId: string) {
  const owners = await tx.membership.count({ where: { role: "OWNER", active: true, id: { not: leavingMembershipId } } });
  if (owners === 0) throw new DomainError("conflict", "An organisation needs at least one owner. Make someone else an owner first.");
}

export async function changeRole(ctx: Ctx, membershipId: string, role: Role) {
  assertCan(ctx.actor, "manageMembers");
  assertMayGive(ctx.actor, role);
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const member = await tx.membership.findFirst({ where: { id: membershipId, active: true }, include: { user: true } });
      if (!member) throw new DomainError("not-found", "That person isn't a member.");
      if (member.role === role) return;
      assertMayGive(ctx.actor, member.role);
      if (member.role === "OWNER") await assertOwnerRemains(tx, member.id);
      await tx.membership.update({ where: { id: member.id }, data: { role } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "member.role_changed", { type: "Membership", id: member.id }, {
        email: member.user.email,
        from: member.role,
        to: role,
      }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function removeMember(ctx: Ctx, membershipId: string) {
  assertCan(ctx.actor, "manageMembers");
  const now = ctx.now ?? new Date();
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const member = await tx.membership.findFirst({ where: { id: membershipId, active: true }, include: { user: true } });
      if (!member) throw new DomainError("not-found", "That person isn't a member.");
      assertMayGive(ctx.actor, member.role);
      if (member.role === "OWNER") await assertOwnerRemains(tx, member.id);
      await tx.membership.update({ where: { id: member.id }, data: { active: false } });
      // Their sessions in this organisation end at once.
      await tx.session.updateMany({
        where: { userId: member.userId, activeOrganisationId: ctx.organisationId, revokedAt: null },
        data: { revokedAt: now },
      });
      await audit(tx, ctx.organisationId, who(ctx.actor), "member.removed", { type: "Membership", id: member.id }, {
        email: member.user.email,
        role: member.role,
      }, ctx.ipAddress);
    },
    ctx.db,
  );
}

export async function renameOrganisation(ctx: Ctx, name: string) {
  assertCan(ctx.actor, "manageOrganisation");
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 120) throw new DomainError("invalid", "Enter a name under 120 characters.", "name");
  await asTenant(
    ctx.organisationId,
    async (tx) => {
      const org = await tx.organisation.findUniqueOrThrow({ where: { id: ctx.organisationId } });
      if (org.name === clean) return;
      await tx.organisation.update({ where: { id: org.id }, data: { name: clean } });
      await audit(tx, ctx.organisationId, who(ctx.actor), "organisation.renamed", { type: "Organisation", id: org.id }, { from: org.name, to: clean }, ctx.ipAddress);
    },
    ctx.db,
  );
}

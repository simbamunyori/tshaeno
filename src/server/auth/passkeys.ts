import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { PrismaClient } from "@prisma/client";
import { setScope } from "@/server/db";
import { audit } from "@/server/org/audit";
import { AuthError, assertAnotherWayIn, signInWithPasskey, type AuthDeps, type RequestContext, type SessionWithUser } from "./service";

/**
 * Passkeys with WebAuthn. Each challenge is stored once, lasts five
 * minutes and is deleted the moment it is used, so a response can't be
 * replayed.
 */

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RP_NAME = "Tshaeno";

export interface RelyingParty {
  origin: string;
  rpId: string;
}

async function storeChallenge(db: PrismaClient, purpose: string, challenge: string, userId: string | null, now: Date) {
  // Old challenges are tidied up as new ones are made.
  await db.authChallenge.deleteMany({ where: { expiresAt: { lt: now } } });
  const row = await db.authChallenge.create({
    data: { purpose, challenge, userId, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) },
  });
  return row.id;
}

/** Uses up a challenge. Null when it is unknown, for something else, or expired. */
async function takeChallenge(db: PrismaClient, id: string, purpose: string, now: Date) {
  const row = await db.authChallenge.findUnique({ where: { id } });
  if (!row) return null;
  const taken = await db.authChallenge.deleteMany({ where: { id } });
  if (taken.count !== 1 || row.purpose !== purpose || row.expiresAt.getTime() <= now.getTime()) return null;
  return row;
}

export async function beginPasskeyRegistration(deps: AuthDeps, rp: RelyingParty, session: SessionWithUser) {
  if (session.stage !== "ACTIVE") throw new AuthError("no-session", "Your sign-in timed out. Start again.");
  const existing = await deps.db.passkey.findMany({ where: { userId: session.userId }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpId,
    userName: session.user.email,
    userDisplayName: session.user.name,
    userID: new TextEncoder().encode(session.userId),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const challengeId = await storeChallenge(deps.db, "passkey-register", options.challenge, session.userId, deps.now?.() ?? new Date());
  return { challengeId, options };
}

export async function finishPasskeyRegistration(
  deps: AuthDeps,
  rp: RelyingParty,
  session: SessionWithUser,
  input: { challengeId: string; response: RegistrationResponseJSON; name: string },
  ctx: RequestContext = {},
) {
  const now = deps.now?.() ?? new Date();
  const challenge = await takeChallenge(deps.db, input.challengeId, "passkey-register", now);
  if (!challenge || challenge.userId !== session.userId) throw new AuthError("invalid-input", "That took too long. Try again.");
  const result = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpId,
    requireUserVerification: true,
  });
  if (!result.verified) throw new AuthError("invalid-input", "Your device didn't confirm the passkey. Try again.");
  const { credential } = result.registrationInfo;
  const name = input.name.trim().slice(0, 60) || "Passkey";
  await deps.db.$transaction(async (tx) => {
    const passkey = await tx.passkey.create({
      data: {
        userId: session.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        name,
      },
    });
    if (session.activeOrganisationId) {
      await setScope(tx, { orgId: session.activeOrganisationId });
      await audit(tx, session.activeOrganisationId, { userId: session.userId, name: session.user.name }, "auth.passkey_added", {
        type: "Passkey",
        id: passkey.id,
      }, { name }, ctx.ipAddress);
    }
  });
}

export async function beginPasskeySignIn(deps: AuthDeps, rp: RelyingParty) {
  // No allowCredentials: the browser offers the passkeys it has for this site.
  const options = await generateAuthenticationOptions({ rpID: rp.rpId, userVerification: "required" });
  const challengeId = await storeChallenge(deps.db, "passkey-sign-in", options.challenge, null, deps.now?.() ?? new Date());
  return { challengeId, options };
}

export async function finishPasskeySignIn(
  deps: AuthDeps,
  rp: RelyingParty,
  input: { challengeId: string; response: AuthenticationResponseJSON },
  ctx: RequestContext = {},
): Promise<{ token: string }> {
  const now = deps.now?.() ?? new Date();
  const challenge = await takeChallenge(deps.db, input.challengeId, "passkey-sign-in", now);
  if (!challenge) throw new AuthError("invalid-input", "That took too long. Try again.");
  const passkey = await deps.db.passkey.findUnique({ where: { credentialId: input.response.id } });
  if (!passkey) throw new AuthError("invalid-credentials", "That passkey isn't registered with Tshaeno.");
  const result = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpId,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports,
    },
  });
  if (!result.verified) throw new AuthError("invalid-credentials", "That passkey didn't check out.");
  return signInWithPasskey(deps, { id: passkey.id, userId: passkey.userId, newCounter: result.authenticationInfo.newCounter }, ctx);
}

export async function removePasskey(deps: AuthDeps, session: SessionWithUser, passkeyId: string, ctx: RequestContext = {}) {
  await deps.db.$transaction(async (tx) => {
    const passkey = await tx.passkey.findFirst({ where: { id: passkeyId, userId: session.userId } });
    if (!passkey) throw new AuthError("invalid-input", "That passkey isn't yours.");
    await assertAnotherWayIn(tx, session.userId, { passkeyId });
    await tx.passkey.delete({ where: { id: passkey.id } });
    if (session.activeOrganisationId) {
      await setScope(tx, { orgId: session.activeOrganisationId });
      await audit(tx, session.activeOrganisationId, { userId: session.userId, name: session.user.name }, "auth.passkey_removed", {
        type: "Passkey",
        id: passkey.id,
      }, { name: passkey.name }, ctx.ipAddress);
    }
  });
}

export type { AuthenticationResponseJSON, RegistrationResponseJSON };

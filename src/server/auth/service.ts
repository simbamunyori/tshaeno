import { createHash, randomBytes } from "node:crypto";
import type { IdentityProvider, Prisma, PrismaClient, Role, Session, SessionStage, SignInMethod, User } from "@prisma/client";
import { setScope, type Tx } from "@/server/db";
import { startTrial } from "@/server/billing/trial";
import { audit as orgAudit } from "@/server/org/audit";
import { burnPasswordCheck, hashPassword, passwordStrength, verifyPassword } from "./password";
import { generateRecoveryCodes, hashRecoveryCode, looksLikeRecoveryCode } from "./recovery-codes";
import { open, seal } from "./secret-box";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

/**
 * Sign-up, sign-in and sessions.
 *
 * - Email and password always needs a second step: an authenticator app,
 *   set up straight after the password the first time.
 * - Google and Microsoft sign-in ask for the authenticator too when the
 *   person has one set up; otherwise the provider's own sign-in is the check.
 * - A passkey is two factors in one (the device and its lock), so it signs
 *   in fully on its own.
 *
 * Functions take the database client and a key so they can be tested
 * against a real database without Next.js.
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
/** Time allowed between the first step and the code step. */
export const PENDING_TTL_MS = 10 * 60 * 1000;
/** Signed out after this long without activity. */
export const IDLE_TTL_MS = 12 * 60 * 60 * 1000;
/** Signed out after this long regardless of activity. */
export const ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Avoid a database write on every request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface AuthDeps {
  db: PrismaClient;
  /** Base64 32-byte key for sealing TOTP secrets. */
  encryptionKey: string;
  now?: () => Date;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuthError extends Error {
  constructor(
    public readonly code:
      | "invalid-credentials"
      | "locked"
      | "invalid-code"
      | "email-taken"
      | "weak-password"
      | "invalid-input"
      | "no-session"
      | "link-required",
    message: string,
    public readonly lockedUntil?: Date,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type SessionWithUser = Session & { user: User };

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function clock(deps: AuthDeps): Date {
  return deps.now ? deps.now() : new Date();
}

function expiryFor(stage: SessionStage, now: Date): Date {
  return new Date(now.getTime() + (stage === "ACTIVE" ? IDLE_TTL_MS : PENDING_TTL_MS));
}

async function createSession(
  tx: Tx,
  userId: string,
  stage: SessionStage,
  method: SignInMethod,
  organisationId: string | null,
  ctx: RequestContext,
  now: Date,
): Promise<string> {
  const token = newToken();
  await tx.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      stage,
      method,
      activeOrganisationId: organisationId,
      expiresAt: expiryFor(stage, now),
      lastSeenAt: now,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent?.slice(0, 400) ?? null,
    },
  });
  return token;
}

/** The organisation this person joined first and is still in. */
async function primaryOrganisationId(tx: Tx, userId: string): Promise<string | null> {
  await setScope(tx, { userId });
  const m = await tx.membership.findFirst({
    where: { userId, active: true, organisation: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: { organisationId: true },
  });
  return m?.organisationId ?? null;
}

/** An audit row in the organisation the person is working in, if any. */
async function audit(
  tx: Tx,
  organisationId: string | null,
  user: Pick<User, "id" | "name">,
  action: string,
  ctx: RequestContext,
  data?: Prisma.InputJsonValue,
) {
  if (!organisationId) return;
  await setScope(tx, { orgId: organisationId });
  await orgAudit(tx, organisationId, { userId: user.id, name: user.name }, action, { type: "User", id: user.id }, data, ctx.ipAddress);
}

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "organisation"
  );
}

export function cleanOrganisationName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  if (!name) throw new AuthError("invalid-input", "Enter your organisation's name.");
  if (name.length > 120) throw new AuthError("invalid-input", "Keep the name under 120 characters.");
  return name;
}

/** The organisation's own row, with a unique slug. Callers add its people and plan. */
export async function newOrganisationRow(tx: Tx, name: string, data: Omit<Prisma.OrganisationUncheckedCreateInput, "name" | "slug"> = {}) {
  await setScope(tx, { system: true });
  const base = slugify(name);
  const slug = (await tx.organisation.findUnique({ where: { slug: base }, select: { id: true } }))
    ? `${base}-${randomBytes(3).toString("hex")}`
    : base;
  return tx.organisation.create({ data: { ...data, name, slug } });
}

/** A new organisation with this person as its owner. */
export async function createOrganisation(tx: Tx, user: Pick<User, "id" | "name">, name: string, ctx: RequestContext) {
  const org = await newOrganisationRow(tx, name);
  await tx.membership.create({ data: { organisationId: org.id, userId: user.id, role: "OWNER" } });
  await startTrial(tx, org);
  await audit(tx, org.id, user, "organisation.created", ctx, { name });
  return org;
}

// ─── Sign-up ─────────────────────────────────────────────────────────

export interface SignUpInput {
  organisationName: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Creates the organisation and its owner, and returns a session that can
 * only set up the authenticator.
 */
export async function signUp(deps: AuthDeps, input: SignUpInput, ctx: RequestContext = {}): Promise<{ token: string }> {
  const email = normaliseEmail(input.email);
  const name = input.name.trim();
  if (!input.organisationName.trim() || !name || !looksLikeEmail(email)) {
    throw new AuthError("invalid-input", "Fill in every field.");
  }
  const organisationName = cleanOrganisationName(input.organisationName);
  if (passwordStrength(input.password, [email, name, organisationName]) !== "strong") {
    throw new AuthError("weak-password", "Choose a password of at least 12 characters that isn't easy to guess.");
  }
  const passwordHash = await hashPassword(input.password);
  const now = clock(deps);

  return deps.db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new AuthError("email-taken", "An account with this email already exists. Sign in instead.");
    }
    const user = await tx.user.create({ data: { email, name, passwordHash } });
    const org = await createOrganisation(tx, user, organisationName, ctx);
    await queueEmailCheck(tx, user);
    const token = await createSession(tx, user.id, "SETUP_PENDING", "PASSWORD", org.id, ctx, now);
    return { token };
  });
}

// ─── Sign-in with a password ─────────────────────────────────────────

async function recordFailure(deps: AuthDeps, user: User, ctx: RequestContext, now: Date): Promise<never> {
  const attempts = user.failedAttempts + 1;
  const lock = attempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = lock ? new Date(now.getTime() + LOCKOUT_MS) : null;
  await deps.db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? lockedUntil : user.lockedUntil },
    });
    await audit(tx, await primaryOrganisationId(tx, user.id), user, lock ? "auth.locked" : "auth.sign_in_failed", ctx);
    if (lock) {
      await tx.session.updateMany({
        where: { userId: user.id, stage: { not: "ACTIVE" }, revokedAt: null },
        data: { revokedAt: now },
      });
    }
  });
  if (lock) throw new AuthError("locked", "Too many attempts.", lockedUntil!);
  throw new AuthError("invalid-credentials", "That didn't match.");
}

function assertNotLocked(user: User, now: Date) {
  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    throw new AuthError("locked", "Too many attempts.", user.lockedUntil);
  }
}

/**
 * Checks email and password. Returns a session waiting for the
 * authenticator code, or for its setup if there is none yet. A wrong email
 * and a wrong password look the same to the caller and take as long.
 */
export async function startSignIn(
  deps: AuthDeps,
  input: { email: string; password: string },
  ctx: RequestContext = {},
): Promise<{ token: string; stage: SessionStage }> {
  const now = clock(deps);
  const user = await deps.db.user.findUnique({ where: { email: normaliseEmail(input.email) } });
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(input.password);
    throw new AuthError("invalid-credentials", "Email or password is incorrect.");
  }
  assertNotLocked(user, now);
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    return recordFailure(deps, user, ctx, now);
  }
  const stage: SessionStage = user.totpEnabled ? "CODE_PENDING" : "SETUP_PENDING";
  const token = await deps.db.$transaction(async (tx) =>
    createSession(tx, user.id, stage, "PASSWORD", await primaryOrganisationId(tx, user.id), ctx, now),
  );
  return { token, stage };
}

// ─── Sessions ────────────────────────────────────────────────────────

/** The session for a cookie value, or null if unknown, revoked or expired. */
export async function getSession(deps: AuthDeps, token: string | undefined | null): Promise<SessionWithUser | null> {
  if (!token || token.length > 100) return null;
  const now = clock(deps);
  const session = await deps.db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.revokedAt) return null;
  if (session.expiresAt.getTime() <= now.getTime()) return null;
  if (session.createdAt.getTime() + ABSOLUTE_TTL_MS <= now.getTime()) return null;
  if (session.stage === "ACTIVE" && now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    return deps.db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now, expiresAt: expiryFor("ACTIVE", now) },
      include: { user: true },
    });
  }
  return session;
}

async function requireStage(deps: AuthDeps, token: string, stages: SessionStage[]): Promise<SessionWithUser> {
  const session = await getSession(deps, token);
  if (!session || !stages.includes(session.stage)) {
    throw new AuthError("no-session", "Your sign-in timed out. Start again.");
  }
  return session;
}

/**
 * Replaces a pending session with a fully signed-in one under a new
 * token, so a token seen before sign-in is worthless afterwards.
 */
async function promote(tx: Tx, session: SessionWithUser, ctx: RequestContext, now: Date): Promise<string> {
  await tx.session.update({ where: { id: session.id }, data: { revokedAt: now } });
  return startActiveSession(tx, session.user, session.method, ctx, now, session.activeOrganisationId);
}

async function startActiveSession(
  tx: Tx,
  user: User,
  method: SignInMethod,
  ctx: RequestContext,
  now: Date,
  preferredOrganisationId?: string | null,
): Promise<string> {
  const orgId = preferredOrganisationId ?? (await primaryOrganisationId(tx, user.id));
  await tx.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now } });
  await audit(tx, orgId, user, "auth.sign_in", ctx, { method });
  return createSession(tx, user.id, "ACTIVE", method, orgId, ctx, now);
}

export async function signOut(deps: AuthDeps, token: string | undefined | null, ctx: RequestContext = {}) {
  if (!token) return;
  const now = clock(deps);
  const session = await deps.db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.revokedAt) return;
  await deps.db.$transaction(async (tx) => {
    await tx.session.update({ where: { id: session.id }, data: { revokedAt: now } });
    if (session.stage === "ACTIVE") await audit(tx, session.activeOrganisationId, session.user, "auth.sign_out", ctx);
  });
}

// ─── Authenticator setup ─────────────────────────────────────────────

/**
 * The secret to show as a QR code. Created on first call and kept until
 * setup is confirmed, so refreshing the page shows the same code. Works
 * during sign-up and from Security settings when signed in.
 */
export async function beginAuthenticatorSetup(
  deps: AuthDeps,
  token: string,
): Promise<{ secret: string; uri: string; email: string }> {
  const session = await requireStage(deps, token, ["SETUP_PENDING", "ACTIVE"]);
  if (session.user.totpEnabled) throw new AuthError("invalid-input", "Your authenticator is already set up.");
  let secret: string;
  if (session.user.totpSecret) {
    secret = open(session.user.totpSecret, deps.encryptionKey);
  } else {
    secret = generateTotpSecret();
    await deps.db.user.update({
      where: { id: session.userId },
      data: { totpSecret: seal(secret, deps.encryptionKey), totpEnabled: false, totpLastStep: null },
    });
  }
  return { secret, uri: otpauthUri(secret, session.user.email), email: session.user.email };
}

/**
 * Confirms the app is set up by checking one code. Returns ten backup
 * codes, shown to the person once, and during sign-up the new
 * signed-in session.
 */
export async function confirmAuthenticatorSetup(
  deps: AuthDeps,
  token: string,
  code: string,
  ctx: RequestContext = {},
): Promise<{ token: string | null; recoveryCodes: string[] }> {
  const now = clock(deps);
  const session = await requireStage(deps, token, ["SETUP_PENDING", "ACTIVE"]);
  const user = session.user;
  assertNotLocked(user, now);
  if (!user.totpSecret || user.totpEnabled) throw new AuthError("no-session", "Start the setup again.");
  const step = verifyTotp(open(user.totpSecret, deps.encryptionKey), code, { at: now });
  if (step === null) return recordFailure(deps, user, ctx, now);

  const recoveryCodes = generateRecoveryCodes();
  const newToken = await deps.db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { totpEnabled: true, totpLastStep: step } });
    await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.recoveryCode.createMany({
      data: recoveryCodes.map((c) => ({ userId: user.id, codeHash: hashRecoveryCode(c) })),
    });
    await audit(tx, session.activeOrganisationId, user, "auth.authenticator_set_up", ctx);
    return session.stage === "SETUP_PENDING" ? promote(tx, session, ctx, now) : null;
  });
  return { token: newToken, recoveryCodes };
}

// ─── Sign-in, second step: code ──────────────────────────────────────

/** Accepts a six-digit code from the app, or one of the backup codes. */
export async function completeSignIn(
  deps: AuthDeps,
  token: string,
  code: string,
  ctx: RequestContext = {},
): Promise<{ token: string; usedRecoveryCode: boolean; recoveryCodesLeft: number }> {
  const now = clock(deps);
  const session = await requireStage(deps, token, ["CODE_PENDING"]);
  const user = session.user;
  assertNotLocked(user, now);
  if (!user.totpSecret || !user.totpEnabled) throw new AuthError("no-session", "Start again.");

  if (looksLikeRecoveryCode(code)) {
    const hash = hashRecoveryCode(code);
    return deps.db.$transaction(async (tx) => {
      const used = await tx.recoveryCode.updateMany({
        where: { userId: user.id, codeHash: hash, usedAt: null },
        data: { usedAt: now },
      });
      if (used.count !== 1) return recordFailure(deps, user, ctx, now);
      const left = await tx.recoveryCode.count({ where: { userId: user.id, usedAt: null } });
      await audit(tx, session.activeOrganisationId, user, "auth.recovery_code_used", ctx, { left });
      return { token: await promote(tx, session, ctx, now), usedRecoveryCode: true, recoveryCodesLeft: left };
    });
  }

  const step = verifyTotp(open(user.totpSecret, deps.encryptionKey), code, { at: now, lastUsedStep: user.totpLastStep });
  if (step === null) return recordFailure(deps, user, ctx, now);
  return deps.db.$transaction(async (tx) => {
    // Conditional update: two requests racing with the same code can't both win.
    const claimed = await tx.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    if (claimed.count !== 1) throw new AuthError("invalid-code", "That code has already been used. Wait for the next one.");
    const left = await tx.recoveryCode.count({ where: { userId: user.id, usedAt: null } });
    return { token: await promote(tx, session, ctx, now), usedRecoveryCode: false, recoveryCodesLeft: left };
  });
}

// ─── Google and Microsoft ────────────────────────────────────────────

export interface VerifiedIdentity {
  provider: IdentityProvider;
  subject: string;
  email: string;
  /** True only when the provider vouches that this person owns the address. */
  emailVerified: boolean;
  name: string;
}

export const PROVIDER_LABEL: Record<IdentityProvider, string> = { GOOGLE: "Google", MICROSOFT: "Microsoft", FOURTHGEN: "Fourth Generation" };

/**
 * Signs in with an identity the provider has just vouched for. A known
 * identity signs in its person. An unknown one joins the account with the
 * same email only when the provider says the email is verified (Google);
 * Microsoft accounts are linked from Security settings instead, because
 * Entra lets an organisation's admin set any email on an account.
 * Someone new gets an account with no organisation yet.
 */
export async function signInWithIdentity(
  deps: AuthDeps,
  identity: VerifiedIdentity,
  ctx: RequestContext = {},
): Promise<{ token: string; stage: SessionStage; isNew: boolean }> {
  const now = clock(deps);
  const email = normaliseEmail(identity.email);
  const method: SignInMethod = identity.provider;
  return deps.db.$transaction(async (tx) => {
    const known = await tx.identity.findUnique({
      where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
      include: { user: true },
    });
    let user: User;
    let isNew = false;
    if (known) {
      user = known.user;
      await tx.identity.update({ where: { id: known.id }, data: { lastUsedAt: now, email } });
    } else {
      const sameEmail = await tx.user.findUnique({ where: { email } });
      if (sameEmail) {
        if (!identity.emailVerified) {
          throw new AuthError(
            "link-required",
            `An account with ${email} already exists. Sign in another way, then link ${PROVIDER_LABEL[identity.provider]} in Security settings.`,
          );
        }
        user = sameEmail;
        if (!user.emailVerifiedAt) user = await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      } else {
        if (!looksLikeEmail(email)) throw new AuthError("invalid-input", "Your account has no email address we can use.");
        user = await tx.user.create({
          data: { email, name: identity.name.trim() || email, emailVerifiedAt: identity.emailVerified ? now : null },
        });
        isNew = true;
        if (!identity.emailVerified) await queueEmailCheck(tx, user);
      }
      await tx.identity.create({
        data: { userId: user.id, provider: identity.provider, subject: identity.subject, email, lastUsedAt: now },
      });
      await audit(tx, await primaryOrganisationId(tx, user.id), user, "auth.identity_linked", ctx, { provider: identity.provider });
    }
    assertNotLocked(user, now);
    if (identity.provider === "FOURTHGEN" && identity.emailVerified) await acceptWaitingInvitations(tx, user, ctx, now);
    if (user.totpEnabled) {
      const token = await createSession(tx, user.id, "CODE_PENDING", method, await primaryOrganisationId(tx, user.id), ctx, now);
      return { token, stage: "CODE_PENDING" as const, isNew };
    }
    return { token: await startActiveSession(tx, user, method, ctx, now), stage: "ACTIVE" as const, isNew };
  });
}

/** Links a Google or Microsoft account to someone already signed in. */
export async function linkIdentity(deps: AuthDeps, session: SessionWithUser, identity: VerifiedIdentity, ctx: RequestContext = {}) {
  if (session.stage !== "ACTIVE") throw new AuthError("no-session", "Your sign-in timed out. Start again.");
  const now = clock(deps);
  await deps.db.$transaction(async (tx) => {
    const known = await tx.identity.findUnique({
      where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
    });
    if (known && known.userId !== session.userId) {
      throw new AuthError("invalid-input", `That ${PROVIDER_LABEL[identity.provider]} account is linked to someone else.`);
    }
    if (known) return;
    await tx.identity.create({
      data: {
        userId: session.userId,
        provider: identity.provider,
        subject: identity.subject,
        email: normaliseEmail(identity.email),
        lastUsedAt: now,
      },
    });
    await audit(tx, session.activeOrganisationId, session.user, "auth.identity_linked", ctx, { provider: identity.provider });
  });
}

/** Removes a linked account, as long as another way to sign in remains. */
export async function unlinkIdentity(deps: AuthDeps, session: SessionWithUser, identityId: string, ctx: RequestContext = {}) {
  await deps.db.$transaction(async (tx) => {
    const identity = await tx.identity.findFirst({ where: { id: identityId, userId: session.userId } });
    if (!identity) throw new AuthError("invalid-input", "That account isn't linked.");
    await assertAnotherWayIn(tx, session.userId, { identityId });
    await tx.identity.delete({ where: { id: identity.id } });
    await audit(tx, session.activeOrganisationId, session.user, "auth.identity_unlinked", ctx, { provider: identity.provider });
  });
}

/** Nobody may remove their last way to sign in. */
export async function assertAnotherWayIn(tx: Tx, userId: string, removing: { identityId?: string; passkeyId?: string }) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  const identities = await tx.identity.count({ where: { userId, id: removing.identityId ? { not: removing.identityId } : undefined } });
  const passkeys = await tx.passkey.count({ where: { userId, id: removing.passkeyId ? { not: removing.passkeyId } : undefined } });
  if (!user.passwordHash && identities === 0 && passkeys === 0) {
    throw new AuthError("invalid-input", "This is your only way to sign in. Add another first.");
  }
}

// ─── Passkeys ────────────────────────────────────────────────────────

/** Signs in fully with a passkey the browser has just proved. */
export async function signInWithPasskey(
  deps: AuthDeps,
  passkey: { id: string; userId: string; newCounter: number },
  ctx: RequestContext = {},
): Promise<{ token: string }> {
  const now = clock(deps);
  return deps.db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: passkey.userId } });
    assertNotLocked(user, now);
    await tx.passkey.update({ where: { id: passkey.id }, data: { counter: passkey.newCounter, lastUsedAt: now } });
    return { token: await startActiveSession(tx, user, "PASSKEY", ctx, now) };
  });
}

// ─── Invitations ─────────────────────────────────────────────────────

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Makes a new link token. Only its hash is kept. */
export function newLinkToken(): { token: string; tokenHash: string } {
  const token = newToken();
  return { token, tokenHash: hashToken(token) };
}

export type InvitationLookup =
  | { state: "INVALID" }
  | {
      state: "VALID" | "EXPIRED" | "ACCEPTED" | "REVOKED";
      invitation: Prisma.InvitationGetPayload<{ include: { organisation: true; invitedBy: { include: { user: true } } } }>;
      /** True when the email already has a Tshaeno account. */
      hasAccount: boolean;
    };

export async function lookupInvitation(deps: AuthDeps, token: string): Promise<InvitationLookup> {
  if (!token || token.length > 100) return { state: "INVALID" };
  return deps.db.$transaction(async (tx) => {
    // The link itself is the permission to read this one invitation.
    await setScope(tx, { system: true });
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { organisation: true, invitedBy: { include: { user: true } } },
    });
    if (!invitation) return { state: "INVALID" as const };
    const hasAccount = Boolean(await tx.user.findUnique({ where: { email: invitation.email }, select: { id: true } }));
    const now = clock(deps);
    const state = invitation.revokedAt
      ? "REVOKED"
      : invitation.acceptedAt
        ? "ACCEPTED"
        : invitation.expiresAt.getTime() <= now.getTime() || invitation.organisation.status !== "ACTIVE"
          ? "EXPIRED"
          : "VALID";
    return { state, invitation, hasAccount } as const;
  });
}

async function claimInvitation(tx: Tx, token: string, now: Date) {
  await setScope(tx, { system: true });
  const invitation = await tx.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { organisation: true } });
  if (!invitation || invitation.organisation.status !== "ACTIVE") {
    throw new AuthError("invalid-input", "This invitation link isn't valid.");
  }
  const claimed = await tx.invitation.updateMany({
    where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    data: { acceptedAt: now, tokenHash: null },
  });
  if (claimed.count !== 1) throw new AuthError("invalid-input", "This invitation has already been used, withdrawn or has expired.");
  return invitation;
}

async function joinOrganisation(tx: Tx, invitation: { organisationId: string; role: Role }, userId: string) {
  await tx.membership.upsert({
    where: { organisationId_userId: { organisationId: invitation.organisationId, userId } },
    create: { organisationId: invitation.organisationId, userId, role: invitation.role },
    update: { role: invitation.role, active: true },
  });
}

/**
 * Creates the invited person's account with a password. Opening the
 * emailed link proves they own the address. Returns a session that can
 * only set up the authenticator, exactly like signing up.
 */
export async function acceptInvitationAsNewUser(
  deps: AuthDeps,
  token: string,
  input: { name: string; password: string },
  ctx: RequestContext = {},
): Promise<{ token: string }> {
  const name = input.name.trim();
  if (!name) throw new AuthError("invalid-input", "Enter your name.");
  const found = await lookupInvitation(deps, token);
  if (found.state === "INVALID") throw new AuthError("invalid-input", "This invitation link isn't valid.");
  if (passwordStrength(input.password, [found.invitation.email, name, found.invitation.organisation.name]) !== "strong") {
    throw new AuthError("weak-password", "Choose a password of at least 12 characters that isn't easy to guess.");
  }
  const passwordHash = await hashPassword(input.password);
  const now = clock(deps);
  return deps.db.$transaction(async (tx) => {
    const invitation = await claimInvitation(tx, token, now);
    if (await tx.user.findUnique({ where: { email: invitation.email }, select: { id: true } })) {
      throw new AuthError("email-taken", "An account with this email already exists. Sign in to accept.");
    }
    const user = await tx.user.create({ data: { email: invitation.email, name, passwordHash, emailVerifiedAt: now } });
    await joinOrganisation(tx, invitation, user.id);
    await audit(tx, invitation.organisationId, user, "member.joined", ctx, { invitationId: invitation.id, role: invitation.role });
    return { token: await createSession(tx, user.id, "SETUP_PENDING", "PASSWORD", invitation.organisationId, ctx, now) };
  });
}

/**
 * Someone arriving from the Fourth Generation console, which vouches for
 * their address, joins every organisation still waiting for them. This is
 * how a customer who bought Tshaeno there gets straight in.
 */
async function acceptWaitingInvitations(tx: Tx, user: Pick<User, "id" | "name" | "email">, ctx: RequestContext, now: Date) {
  await setScope(tx, { system: true });
  const waiting = await tx.invitation.findMany({
    where: { email: user.email, acceptedAt: null, revokedAt: null, expiresAt: { gt: now }, organisation: { status: "ACTIVE" } },
    select: { id: true, organisationId: true, role: true },
  });
  for (const invitation of waiting) {
    await setScope(tx, { system: true });
    const claimed = await tx.invitation.updateMany({ where: { id: invitation.id, acceptedAt: null }, data: { acceptedAt: now, tokenHash: null } });
    if (claimed.count !== 1) continue;
    await joinOrganisation(tx, invitation, user.id);
    await audit(tx, invitation.organisationId, user, "member.joined", ctx, { invitationId: invitation.id, role: invitation.role, via: "FOURTHGEN" });
  }
}

/** Someone already signed in joins the organisation that invited them. */
export async function acceptInvitationAsExistingUser(
  deps: AuthDeps,
  token: string,
  session: SessionWithUser,
  ctx: RequestContext = {},
): Promise<void> {
  const now = clock(deps);
  await deps.db.$transaction(async (tx) => {
    const invitation = await claimInvitation(tx, token, now);
    if (invitation.email !== session.user.email) {
      throw new AuthError("invalid-input", `This invitation is for ${invitation.email}. Sign in with that email to accept it.`);
    }
    await joinOrganisation(tx, invitation, session.userId);
    await tx.session.update({ where: { id: session.id }, data: { activeOrganisationId: invitation.organisationId } });
    if (!session.user.emailVerifiedAt) {
      // The invitation reached this address, which proves it.
      await tx.user.update({ where: { id: session.userId }, data: { emailVerifiedAt: now, emailTokenHash: null } });
    }
    await audit(tx, invitation.organisationId, session.user, "member.joined", ctx, { invitationId: invitation.id, role: invitation.role });
  });
}

// ─── More than one organisation ──────────────────────────────────────

export interface OrganisationChoice {
  id: string;
  name: string;
  role: Role;
}

/** Every organisation this person can open, oldest membership first. */
export async function organisationsFor(db: PrismaClient, userId: string): Promise<OrganisationChoice[]> {
  return db.$transaction(async (tx) => {
    await setScope(tx, { userId });
    const memberships = await tx.membership.findMany({
      where: { userId, active: true, organisation: { status: "ACTIVE" } },
      orderBy: { createdAt: "asc" },
      select: { role: true, organisation: { select: { id: true, name: true } } },
    });
    return memberships.map((m) => ({ id: m.organisation.id, name: m.organisation.name, role: m.role }));
  });
}

/** Opens another organisation this person belongs to, in the same session. */
export async function switchOrganisation(deps: AuthDeps, session: SessionWithUser, organisationId: string, ctx: RequestContext = {}) {
  if (session.stage !== "ACTIVE") throw new AuthError("no-session", "Your sign-in timed out. Start again.");
  await deps.db.$transaction(async (tx) => {
    await setScope(tx, { userId: session.userId });
    const membership = await tx.membership.findUnique({
      where: { organisationId_userId: { organisationId, userId: session.userId } },
      select: { active: true, organisation: { select: { status: true } } },
    });
    if (!membership?.active || membership.organisation.status !== "ACTIVE") {
      throw new AuthError("invalid-input", "You're not a member of that organisation.");
    }
    if (session.activeOrganisationId === organisationId) return;
    await tx.session.update({ where: { id: session.id }, data: { activeOrganisationId: organisationId } });
    await audit(tx, organisationId, session.user, "auth.switched_organisation", ctx, { from: session.activeOrganisationId });
  });
}

/** Someone signed in starts another organisation. They become its owner and it opens. */
export async function addOrganisation(deps: AuthDeps, session: SessionWithUser, input: { name: string }, ctx: RequestContext = {}) {
  if (session.stage !== "ACTIVE") throw new AuthError("no-session", "Your sign-in timed out. Start again.");
  const name = cleanOrganisationName(input.name);
  return deps.db.$transaction(async (tx) => {
    const org = await createOrganisation(tx, session.user, name, ctx);
    await tx.session.update({ where: { id: session.id }, data: { activeOrganisationId: org.id } });
    return { id: org.id };
  });
}

// ─── Confirming an email address ─────────────────────────────────────

/** A "confirm your email" link works for three days. */
export const EMAIL_LINK_TTL_MS = 3 * 24 * 60 * 60 * 1000;
/** How soon someone can ask for another link. */
export const EMAIL_RESEND_WAIT_MS = 60 * 1000;

/** The link itself is made when the email is sent; see the mail worker. */
async function queueEmailCheck(tx: Tx, user: Pick<User, "id" | "email">) {
  await tx.outboundEmail.create({ data: { kind: "verify_email", toAddress: user.email, payload: { userId: user.id } } });
}

/** Makes a new link for the email about to go out. Older links stop working. */
export async function issueEmailToken(db: PrismaClient, userId: string, now = new Date()): Promise<string> {
  const { token, tokenHash } = newLinkToken();
  await db.user.update({ where: { id: userId }, data: { emailTokenHash: tokenHash, emailTokenSentAt: now } });
  return token;
}

/** Someone asks for another link, from the banner in the app. */
export async function resendEmailCheck(deps: AuthDeps, session: SessionWithUser) {
  if (session.user.emailVerifiedAt) return;
  const now = clock(deps);
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (user.emailTokenSentAt && now.getTime() - user.emailTokenSentAt.getTime() < EMAIL_RESEND_WAIT_MS) {
    throw new AuthError("invalid-input", "We've just sent one. Give it a minute, and check your junk folder.");
  }
  await deps.db.$transaction(async (tx) => {
    // Hold the next resend back even before the email goes out.
    await tx.user.update({ where: { id: user.id }, data: { emailTokenSentAt: now } });
    await queueEmailCheck(tx, user);
  });
}

export type EmailCheck = "VALID" | "CONFIRMED" | "EXPIRED" | "INVALID";

function emailTokenState(user: Pick<User, "emailVerifiedAt" | "emailTokenSentAt"> | null, now: Date): EmailCheck {
  if (!user) return "INVALID";
  if (user.emailVerifiedAt) return "CONFIRMED";
  if (!user.emailTokenSentAt || now.getTime() - user.emailTokenSentAt.getTime() > EMAIL_LINK_TTL_MS) return "EXPIRED";
  return "VALID";
}

/** What the link would do, without using it, so a mail scanner opening it changes nothing. */
export async function lookupEmailToken(deps: AuthDeps, token: string): Promise<{ state: EmailCheck; email?: string }> {
  if (!token || token.length > 100) return { state: "INVALID" };
  const user = await deps.db.user.findUnique({ where: { emailTokenHash: hashToken(token) } });
  return { state: emailTokenState(user, clock(deps)), email: user?.email };
}

/** The person pressed "Confirm" on the page the link opened. */
export async function confirmEmail(deps: AuthDeps, token: string, ctx: RequestContext = {}): Promise<EmailCheck> {
  if (!token || token.length > 100) return "INVALID";
  const now = clock(deps);
  return deps.db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { emailTokenHash: hashToken(token) } });
    const state = emailTokenState(user, now);
    if (state !== "VALID") return state;
    const done = await tx.user.updateMany({
      where: { id: user!.id, emailTokenHash: hashToken(token), emailVerifiedAt: null },
      data: { emailVerifiedAt: now, emailTokenHash: null },
    });
    if (done.count === 0) return "CONFIRMED";
    await audit(tx, await primaryOrganisationId(tx, user!.id), user!, "auth.email_confirmed", ctx);
    return "CONFIRMED";
  });
}

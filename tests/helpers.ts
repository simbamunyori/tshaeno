import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { confirmAuthenticatorSetup, beginAuthenticatorSetup, getSession, signUp, type AuthDeps, type SessionWithUser } from "../src/server/auth/service";
import { totpAt } from "../src/server/auth/totp";

/** Database tests run when DATABASE_URL points at a migrated database (as the app role). */
export const dbUrl = process.env.DATABASE_URL;
export const db = dbUrl ? new PrismaClient() : (undefined as unknown as PrismaClient);

export function testDeps(now?: () => Date): AuthDeps {
  return { db, encryptionKey: KEY, now };
}
const KEY = randomBytes(32).toString("base64");

let n = 0;
/** A unique tag so tests never collide with each other or earlier runs. */
export function tag(): string {
  return `${Date.now().toString(36)}${(n++).toString(36)}${randomBytes(2).toString("hex")}`;
}

/** Signs up a new organisation and its owner, all the way to a signed-in session. */
export async function newOwner(deps: AuthDeps, orgName = "Kalahari Freight") {
  const t = tag();
  const email = `owner-${t}@example.com`;
  const { token: setupToken } = await signUp(deps, { organisationName: `${orgName} ${t}`, name: "Neo Dube", email, password: "correct horse battery staple" });
  const { secret } = await beginAuthenticatorSetup(deps, setupToken);
  const { token } = await confirmAuthenticatorSetup(deps, setupToken, totpAt(secret));
  const session = (await getSession(deps, token!)) as SessionWithUser;
  return { email, secret, token: token!, session, organisationId: session.activeOrganisationId!, userId: session.userId };
}

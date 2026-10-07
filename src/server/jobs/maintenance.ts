import type { PrismaClient } from "@prisma/client";
import { ABSOLUTE_TTL_MS } from "@/server/auth/service";

/** Removes sign-in leftovers nobody can use any more. */
export async function tidyUp(db: PrismaClient, now = new Date()) {
  const challenges = await db.authChallenge.deleteMany({ where: { expiresAt: { lt: now } } });
  // Sessions are kept 30 days past their longest life, for support questions.
  const cutoff = new Date(now.getTime() - ABSOLUTE_TTL_MS - 30 * 24 * 60 * 60 * 1000);
  const sessions = await db.session.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { challenges: challenges.count, sessions: sessions.count };
}

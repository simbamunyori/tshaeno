import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The client, connected as the tshaeno_app role. PostgreSQL row-level
 * security decides which tenant rows it can see, from settings each
 * transaction makes with `asTenant`, `asUser` or `asSystem`. Outside those,
 * it sees global tables (people, sessions, sign-in methods) and no tenant
 * rows at all.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Prisma.TransactionClient;

export interface Scope {
  orgId?: string;
  userId?: string;
  system?: boolean;
}

/**
 * Sets whose data the rest of this transaction works on, replacing any
 * earlier scope. set_config(..., true) lasts until the transaction ends,
 * so a pooled connection never carries one request's tenant into the next.
 */
export async function setScope(tx: Tx, scope: Scope): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.org_id', ${scope.orgId ?? ""}, true),
                              set_config('app.user_id', ${scope.userId ?? ""}, true),
                              set_config('app.system', ${scope.system ? "on" : ""}, true)`;
}

async function run<T>(scope: Scope, fn: (tx: Tx) => Promise<T>, db: PrismaClient = prisma): Promise<T> {
  return db.$transaction(async (tx) => {
    await setScope(tx, scope);
    return fn(tx);
  });
}

/** Work inside one organisation. Every tenant row read or written belongs to it. */
export function asTenant<T>(organisationId: string, fn: (tx: Tx) => Promise<T>, db?: PrismaClient): Promise<T> {
  if (!organisationId) throw new Error("asTenant needs an organisation id.");
  return run({ orgId: organisationId }, fn, db);
}

/** A signed-in person's own memberships and the organisations they belong to. */
export function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>, db?: PrismaClient): Promise<T> {
  if (!userId) throw new Error("asUser needs a user id.");
  return run({ userId }, fn, db);
}

/**
 * Across organisations. Only for sign-up, accepting an invitation, the
 * worker and the platform admin area, which audits every use.
 */
export function asSystem<T>(fn: (tx: Tx) => Promise<T>, db?: PrismaClient): Promise<T> {
  return run({ system: true }, fn, db);
}

export { Prisma };

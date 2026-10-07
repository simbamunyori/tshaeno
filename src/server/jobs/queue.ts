import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "@/server/env";

/** Redis connection settings for BullMQ, from REDIS_URL. */
export function redisConnection(url = env().REDIS_URL): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    tls: u.protocol === "rediss:" ? {} : undefined,
    // BullMQ workers need this; see its docs.
    maxRetriesPerRequest: null,
  };
}

export const MAIL_QUEUE = "mail";
export const MAINTENANCE_QUEUE = "maintenance";

let mailQueue: Queue | undefined;

/**
 * Asks the worker to send waiting email now rather than at its next
 * regular pass. Best effort: the email is already safe in the outbox, so
 * if Redis is down it simply goes out on the next pass.
 */
export async function kickMail(): Promise<void> {
  try {
    mailQueue ??= new Queue(MAIL_QUEUE, { connection: redisConnection() });
    await mailQueue.add("drain", {}, { removeOnComplete: true, removeOnFail: 100 });
  } catch (err) {
    console.warn("Couldn't reach the job queue; email will go on the next pass.", err);
  }
}

export const DIRECTORY_QUEUE = "directory";
export const DELIVERY_QUEUE = "delivery";

/** Retries for pushing one signature: about 30 seconds, 1, 2, 4 and 8 minutes. */
export const PUSH_JOB = { attempts: 6, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: true, removeOnFail: true } as const;

const queues = new Map<string, Queue>();
function queue(name: string): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: redisConnection() });
    queues.set(name, q);
  }
  return q;
}

/**
 * Asks the worker to bring an organisation's Gmail signatures up to date,
 * after anything that could change them. Several changes in quick
 * succession become one pass. Best effort: the nightly pass catches up.
 */
export async function kickDelivery(organisationId: string): Promise<void> {
  try {
    // One job per organisation per few seconds: a burst of edits makes one
    // pass, and an edit made while a pass is running still gets its own.
    const slot = Math.floor(Date.now() / 5_000);
    await queue(DELIVERY_QUEUE).add("plan", { organisationId }, { jobId: `plan-${organisationId}-${slot}`, delay: 5_000, removeOnComplete: true, removeOnFail: true });
  } catch (err) {
    console.warn("Couldn't reach the job queue; signatures will update on the next pass.", err);
  }
}

/** Asks the worker to sync one directory connection now. */
export async function kickSync(connectionId: string): Promise<boolean> {
  try {
    await queue(DIRECTORY_QUEUE).add("sync", { connectionId }, { jobId: `sync-${connectionId}`, removeOnComplete: true, removeOnFail: true });
    return true;
  } catch (err) {
    console.warn("Couldn't reach the job queue to sync.", err);
    return false;
  }
}

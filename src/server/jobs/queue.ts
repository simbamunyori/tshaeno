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

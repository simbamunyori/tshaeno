/**
 * The background worker: a separate process (the "worker" service in
 * docker-compose.yml) that runs BullMQ jobs. Several copies can run at
 * once; every job claims its rows in the database first.
 */
import { Queue, Worker } from "bullmq";
import { prisma } from "@/server/db";
import { drainOutbox } from "@/server/mail/outbox";
import { MAIL_QUEUE, MAINTENANCE_QUEUE, redisConnection } from "@/server/jobs/queue";
import { tidyUp } from "@/server/jobs/maintenance";

async function main() {
  const connection = redisConnection();

  const mail = new Queue(MAIL_QUEUE, { connection });
  // A regular pass catches anything a kick missed, and retries failures.
  await mail.upsertJobScheduler("mail-every-30s", { every: 30_000 }, { name: "drain", opts: { removeOnComplete: true, removeOnFail: 100 } });
  const maintenance = new Queue(MAINTENANCE_QUEUE, { connection });
  await maintenance.upsertJobScheduler("tidy-nightly", { pattern: "30 2 * * *" }, { name: "tidy", opts: { removeOnComplete: 10, removeOnFail: 100 } });

  const workers = [
    new Worker(MAIL_QUEUE, async () => ({ sent: await drainOutbox(prisma) }), { connection, concurrency: 1 }),
    new Worker(MAINTENANCE_QUEUE, async () => tidyUp(prisma), { connection, concurrency: 1 }),
  ];
  for (const w of workers) w.on("failed", (job, err) => console.error(`Job ${job?.name} failed:`, err));
  console.info("Worker started.");

  const stop = async () => {
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([mail.close(), maintenance.close()]);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * The background worker: a separate process (the "worker" service in
 * docker-compose.yml) that runs BullMQ jobs. Several copies can run at
 * once; every job claims its rows in the database first.
 */
import { writeFile } from "node:fs/promises";
import { Queue, UnrecoverableError, Worker } from "bullmq";
import { prisma } from "@/server/db";
import { drainOutbox } from "@/server/mail/outbox";
import { DELIVERY_QUEUE, DIRECTORY_QUEUE, MAIL_QUEUE, MAINTENANCE_QUEUE, PUSH_JOB, redisConnection } from "@/server/jobs/queue";
import { campaignTick } from "@/server/campaigns/service";
import { dueForSync, syncConnection } from "@/server/connections/service";
import { gmailOrganisations, planGmail, pushGmail } from "@/server/delivery/gmail";
import { tidyUp } from "@/server/jobs/maintenance";
import { billingTick, realBillingDeps } from "@/server/billing/service";

const HEARTBEAT_FILE = "/tmp/worker-heartbeat";

async function main() {
  const connection = redisConnection();

  const mail = new Queue(MAIL_QUEUE, { connection });
  // A regular pass catches anything a kick missed, and retries failures.
  await mail.upsertJobScheduler("mail-every-30s", { every: 30_000 }, { name: "drain", opts: { removeOnComplete: true, removeOnFail: 100 } });
  const maintenance = new Queue(MAINTENANCE_QUEUE, { connection });
  await maintenance.upsertJobScheduler("tidy-nightly", { pattern: "30 2 * * *" }, { name: "tidy", opts: { removeOnComplete: 10, removeOnFail: 100 } });
  // Trials, renewals and payments started online but never confirmed.
  await maintenance.upsertJobScheduler("billing-hourly", { pattern: "5 * * * *" }, { name: "billing", opts: { removeOnComplete: 10, removeOnFail: 100 } });

  const directory = new Queue(DIRECTORY_QUEUE, { connection });
  await directory.upsertJobScheduler("sync-due-15m", { every: 15 * 60_000 }, { name: "sync-due", opts: { removeOnComplete: 10, removeOnFail: 100 } });
  const delivery = new Queue(DELIVERY_QUEUE, { connection });
  // Every night, push every Gmail signature again, which also puts back any
  // that someone changed by hand.
  await delivery.upsertJobScheduler("gmail-nightly", { pattern: "0 3 * * *" }, { name: "plan-all", opts: { removeOnComplete: 10, removeOnFail: 100 } });
  // Campaign banners that started or ended: refresh those organisations' Gmail signatures.
  await delivery.upsertJobScheduler("campaigns-5m", { every: 5 * 60_000 }, { name: "campaigns", opts: { removeOnComplete: 10, removeOnFail: 100 } });

  const plan = async (organisationId: string, force = false) => {
    const people = await planGmail(organisationId, { force });
    await delivery.addBulk(people.map((personId) => ({ name: "push", data: { organisationId, personId }, opts: { ...PUSH_JOB, jobId: `push-${personId}` } })));
    return people.length;
  };

  const workers = [
    new Worker(MAIL_QUEUE, async () => ({ sent: await drainOutbox(prisma) }), { connection, concurrency: 1 }),
    new Worker(MAINTENANCE_QUEUE, async (job) => (job.name === "billing" ? billingTick(realBillingDeps()) : tidyUp(prisma)), { connection, concurrency: 1 }),
    new Worker(
      DIRECTORY_QUEUE,
      async (job) => {
        if (job.name === "sync-due") {
          const due = await dueForSync();
          await directory.addBulk(due.map((connectionId) => ({ name: "sync", data: { connectionId }, opts: { jobId: `sync-${connectionId}`, removeOnComplete: true, removeOnFail: true } })));
          return { queued: due.length };
        }
        const outcome = await syncConnection(job.data.connectionId);
        if (!outcome.ok) return outcome;
        await plan(outcome.organisationId);
        return outcome.result;
      },
      { connection, concurrency: 2 },
    ),
    new Worker(
      DELIVERY_QUEUE,
      async (job) => {
        if (job.name === "plan-all") {
          for (const organisationId of await gmailOrganisations()) await plan(organisationId, true);
          return;
        }
        if (job.name === "plan") return { queued: await plan(job.data.organisationId) };
        if (job.name === "campaigns") {
          const organisations = await campaignTick();
          for (const organisationId of organisations) await plan(organisationId);
          return { organisations: organisations.length };
        }
        const final = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        const outcome = await pushGmail(job.data.organisationId, job.data.personId, { final });
        // Throwing makes BullMQ try again later; the reason is already on the delivery row.
        if (outcome === "retry") throw new Error("Will try again.");
        if (outcome === "failed") throw new UnrecoverableError("Gave up; see the delivery row.");
        return outcome;
      },
      { connection, concurrency: 5 },
    ),
  ];
  for (const w of workers) w.on("failed", (job, err) => console.error(`Job ${job?.name} failed:`, err));
  console.info("Worker started.");

  // The container's healthcheck reads this file's age. It is only touched
  // while Redis answers, so a worker cut off from its queue reads unhealthy.
  let beating = false;
  const beat = async () => {
    if (beating) return;
    beating = true;
    try {
      await mail.getJobCounts("waiting");
      await writeFile(HEARTBEAT_FILE, new Date().toISOString());
    } catch (err) {
      console.error("Heartbeat failed:", err);
    } finally {
      beating = false;
    }
  };
  await beat();
  const heartbeat = setInterval(beat, 10_000);

  const stop = async () => {
    clearInterval(heartbeat);
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([mail.close(), maintenance.close(), directory.close(), delivery.close()]);
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

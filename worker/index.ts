import { Worker } from "bullmq";

import { serverEnv } from "@/lib/env";
import { QUEUE_NAME, createQueue, redisConnection } from "@/lib/queue";
import { dispatch } from "./handlers";

const env = serverEnv();

const worker = new Worker(QUEUE_NAME, (job) => dispatch(job.name, job.data), {
  connection: redisConnection(env.REDIS_URL),
  concurrency: 4,
});

// Hourly housekeeping; the scheduler id keeps restarts from duplicating it.
const scheduler = createQueue(env.REDIS_URL);
void scheduler.upsertJobScheduler(
  "cleanup-stale-uploads",
  { every: 60 * 60 * 1000 },
  { name: "cleanup-stale-uploads", data: {} },
);

worker.on("failed", (job, error) => {
  console.error(
    `[worker] job ${job?.name}#${job?.id} failed: ${error.message}`,
  );
});

worker.on("ready", () => {
  console.info(`[worker] listening on queue "${QUEUE_NAME}"`);
});

async function shutdown(signal: string) {
  console.info(`[worker] ${signal} received, draining…`);
  await worker.close();
  await scheduler.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

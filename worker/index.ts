import { Worker } from "bullmq";

import { serverEnv } from "@/lib/env";
import { QUEUE_NAME, redisConnection } from "@/lib/queue";
import { dispatch } from "./handlers";

const env = serverEnv();

const worker = new Worker(QUEUE_NAME, (job) => dispatch(job.name, job.data), {
  connection: redisConnection(env.REDIS_URL),
  concurrency: 4,
});

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
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

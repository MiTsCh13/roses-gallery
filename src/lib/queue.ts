import { Queue, type ConnectionOptions } from "bullmq";
import { z } from "zod";

// Central registry of background jobs. The web app enqueues, the worker in
// /worker consumes. Every payload is validated with Zod on both sides.
export const QUEUE_NAME = "roses-gallery";

export const jobSchemas = {
  ping: z.object({ requestedAt: z.iso.datetime() }),
  "process-photo": z.object({ accountId: z.uuid(), mediaId: z.uuid() }),
  "cleanup-stale-uploads": z.object({}),
  "gallery-expiry": z.object({}),
  "build-zip": z.object({ accountId: z.uuid(), exportId: z.uuid() }),
  "cleanup-zip-exports": z.object({}),
  "cleanup-events": z.object({}),
} as const;

export type JobName = keyof typeof jobSchemas;
export type JobPayload<N extends JobName> = z.infer<(typeof jobSchemas)[N]>;

export function isJobName(name: string): name is JobName {
  return Object.hasOwn(jobSchemas, name);
}

export function parseJobPayload<N extends JobName>(
  name: N,
  data: unknown,
): JobPayload<N> {
  return jobSchemas[name].parse(data) as JobPayload<N>;
}

export function redisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    // Required by BullMQ for blocking worker connections.
    maxRetriesPerRequest: null,
  };
}

export function createQueue(redisUrl: string) {
  return new Queue(QUEUE_NAME, { connection: redisConnection(redisUrl) });
}

export async function enqueue<N extends JobName>(
  queue: Queue,
  name: N,
  payload: JobPayload<N>,
) {
  return queue.add(name, parseJobPayload(name, payload), {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  });
}

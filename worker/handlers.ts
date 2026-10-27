import {
  isJobName,
  parseJobPayload,
  type JobName,
  type JobPayload,
} from "@/lib/queue";

type Handlers = {
  [N in JobName]: (payload: JobPayload<N>) => Promise<unknown>;
};

export const handlers: Handlers = {
  ping: async ({ requestedAt }) => ({ pong: true, requestedAt }),
};

export async function dispatch(name: string, data: unknown) {
  if (!isJobName(name)) {
    throw new Error(`Unknown job: ${name}`);
  }
  const handler = handlers[name] as (payload: unknown) => Promise<unknown>;
  return handler(parseJobPayload(name, data));
}

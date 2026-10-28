import { describe, expect, it } from "vitest";

import { isJobName, parseJobPayload, redisConnection } from "./queue";

describe("job registry", () => {
  it("recognises registered jobs only", () => {
    expect(isJobName("ping")).toBe(true);
    expect(isJobName("toString")).toBe(false);
    expect(isJobName("unknown")).toBe(false);
  });

  it("registers gallery-expiry", () => {
    expect(parseJobPayload("gallery-expiry", {})).toEqual({});
  });

  it("registers cleanup-stale-uploads", () => {
    expect(parseJobPayload("cleanup-stale-uploads", {})).toEqual({});
  });

  it("registers process-photo", () => {
    const ids = {
      accountId: crypto.randomUUID(),
      mediaId: crypto.randomUUID(),
    };
    expect(parseJobPayload("process-photo", ids)).toEqual(ids);
    expect(() => parseJobPayload("process-photo", { mediaId: "x" })).toThrow();
  });

  it("validates payloads", () => {
    const requestedAt = new Date().toISOString();
    expect(parseJobPayload("ping", { requestedAt })).toEqual({ requestedAt });
    expect(() =>
      parseJobPayload("ping", { requestedAt: "yesterday" }),
    ).toThrow();
  });
});

describe("redisConnection", () => {
  it("parses a plain URL", () => {
    expect(redisConnection("redis://localhost:6379")).toMatchObject({
      host: "localhost",
      port: 6379,
      tls: undefined,
      maxRetriesPerRequest: null,
    });
  });

  it("parses credentials, db index and TLS", () => {
    expect(
      redisConnection("rediss://user:secret@cache.example:6380/2"),
    ).toMatchObject({
      host: "cache.example",
      port: 6380,
      username: "user",
      password: "secret",
      db: 2,
      tls: {},
    });
  });
});

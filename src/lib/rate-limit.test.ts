import Redis from "ioredis";
import { afterAll, describe, expect, it } from "vitest";

import { MemoryRateLimiter, RedisRateLimiter } from "./rate-limit";

describe("MemoryRateLimiter", () => {
  it("allows up to the limit, then blocks until the window ends", async () => {
    let now = 0;
    const rl = new MemoryRateLimiter(() => now);
    expect((await rl.hit("k", 2, 60)).allowed).toBe(true);
    expect((await rl.hit("k", 2, 60)).allowed).toBe(true);
    expect(await rl.hit("k", 2, 60)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect((await rl.hit("other", 2, 60)).allowed).toBe(true);
    now = 61_000;
    expect((await rl.hit("k", 2, 60)).allowed).toBe(true);
  });
});

describe("RedisRateLimiter", () => {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  afterAll(async () => {
    await redis.quit();
  });

  it("counts per key and sets an expiry", async () => {
    const key = `test-${crypto.randomUUID()}`;
    const rl = new RedisRateLimiter(redis);
    expect((await rl.hit(key, 1, 30)).allowed).toBe(true);
    const second = await rl.hit(key, 1, 30);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
    expect(await redis.ttl(`rl:${key}`)).toBeGreaterThan(0);
    await redis.del(`rl:${key}`);
  });
});

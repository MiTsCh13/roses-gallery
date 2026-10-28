import Redis from "ioredis";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export interface RateLimiter {
  /** Counts one attempt for `key`; refuses once `limit` is exceeded in the window. */
  hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;
}

/** Fixed-window counter in Redis. */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowSeconds: number) {
    const k = `rl:${key}`;
    const n = await this.redis.incr(k);
    if (n === 1) await this.redis.expire(k, windowSeconds);
    if (n <= limit) return { allowed: true, retryAfterSeconds: 0 };
    const ttl = await this.redis.ttl(k);
    if (ttl < 0) await this.redis.expire(k, windowSeconds); // never lock forever
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
  }
}

/** In-process limiter for tests. */
export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { n: number; resetAt: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, limit: number, windowSeconds: number) {
    const t = this.now();
    let e = this.hits.get(key);
    if (!e || e.resetAt <= t) {
      e = { n: 0, resetAt: t + windowSeconds * 1000 };
      this.hits.set(key, e);
    }
    e.n++;
    return e.n <= limit
      ? { allowed: true, retryAfterSeconds: 0 }
      : {
          allowed: false,
          retryAfterSeconds: Math.ceil((e.resetAt - t) / 1000),
        };
  }
}

let shared: RateLimiter | undefined;
export function getRateLimiter(redisUrl: string): RateLimiter {
  shared ??= new RedisRateLimiter(
    new Redis(redisUrl, { maxRetriesPerRequest: 2 }),
  );
  return shared;
}

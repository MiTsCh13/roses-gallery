import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://roses:roses@localhost:5432/roses_gallery",
  REDIS_URL: "redis://localhost:6379",
};

describe("parseServerEnv", () => {
  it("accepts a valid configuration and defaults NODE_ENV", () => {
    expect(parseServerEnv(valid)).toEqual({
      ...valid,
      NODE_ENV: "development",
    });
  });

  it("rejects a missing DATABASE_URL with a readable message", () => {
    expect(() => parseServerEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects malformed URLs", () => {
    expect(() => parseServerEnv({ ...valid, REDIS_URL: "not a url" })).toThrow(
      /REDIS_URL/,
    );
  });
});

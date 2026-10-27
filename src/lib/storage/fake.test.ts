import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FakeStorage } from "./fake";
import { assertValidKey, derivativeKey, originalKey } from "./types";

let dir: string;
let storage: FakeStorage;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "fake-storage-"));
  storage = new FakeStorage(dir, "secret-secret-secret");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("keys", () => {
  it("accepts tenant-prefixed keys", () => {
    expect(() => assertValidKey(originalKey("a1", "m1", 2))).not.toThrow();
    expect(derivativeKey("a1", "m1", 2, 1200)).toBe("a1/m1/r2-1200.webp");
  });
  it.each(["", "../x", "a/../b", "/abs", "a//b", "a b", "a/b/"])(
    "rejects %j",
    (key) => expect(() => assertValidKey(key)).toThrow(),
  );
});

describe("FakeStorage", () => {
  it("assembles a multipart upload and checks ETags", async () => {
    const key = "acc/med/original-1";
    const id = await storage.createMultipartUpload(key);
    const e1 = await storage.storePart(id, 1, Buffer.from("hello "));
    const e2 = await storage.storePart(id, 2, Buffer.from("world"));
    await storage.completeMultipartUpload(key, id, [
      { partNumber: 2, etag: `"${e2}"` },
      { partNumber: 1, etag: e1 },
    ]);
    expect((await storage.get(key)).toString()).toBe("hello world");
    expect(await storage.head(key)).toEqual({ size: 11 });
  });

  it("rejects a wrong ETag and a foreign key", async () => {
    const id = await storage.createMultipartUpload("a/b");
    await storage.storePart(id, 1, Buffer.from("x"));
    await expect(
      storage.completeMultipartUpload("a/b", id, [
        { partNumber: 1, etag: "bad" },
      ]),
    ).rejects.toThrow();
    await expect(
      storage.completeMultipartUpload("a/other", id, [
        { partNumber: 1, etag: "bad" },
      ]),
    ).rejects.toThrow("Unknown upload");
  });

  it("deletes idempotently and reports missing objects", async () => {
    await storage.put("a/b", Buffer.from("1"));
    await storage.delete("a/b");
    await storage.delete("a/b");
    expect(await storage.head("a/b")).toBeNull();
  });

  it("verifies signed URLs, expiry and tampering", async () => {
    await storage.put("a/b", Buffer.from("1"));
    const url = new URL(await storage.signGet("a/b", 60), "http://x");
    expect(storage.verifyUrl(url.searchParams)).toMatchObject({
      op: "get",
      key: "a/b",
    });

    const tampered = new URLSearchParams(url.searchParams);
    tampered.set("key", "a/c");
    expect(storage.verifyUrl(tampered)).toBeNull();

    const expired = new URL(await storage.signGet("a/b", -10), "http://x");
    expect(storage.verifyUrl(expired.searchParams)).toBeNull();

    const other = new FakeStorage(dir, "another-secret-value");
    expect(other.verifyUrl(url.searchParams)).toBeNull();
  });

  it("validates part numbers and lists keys", async () => {
    await expect(storage.signUploadPart("a/b", "id", 0, 60)).rejects.toThrow(
      RangeError,
    );
    await storage.put("a/1", Buffer.from("1"));
    await storage.put("b/2", Buffer.from("2"));
    expect(await storage.listKeys("a/")).toEqual(["a/1"]);
  });
});

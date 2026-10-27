import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "storage-route-"));
  vi.stubEnv("DATABASE_URL", "postgres://x:x@localhost:5432/x");
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  vi.stubEnv("STORAGE_TRANSPORT", "fake");
  vi.stubEnv("STORAGE_FAKE_DIR", dir);
  vi.stubEnv("AUTH_SECRET", "route-test-secret-value");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("/api/test/storage", () => {
  it("accepts a signed part upload and serves a signed download", async () => {
    const { getStorage } = await import("@/lib/storage");
    const { PUT, GET } = await import("./route");
    const storage = getStorage();
    const key = "acc/med/original-1";
    const uploadId = await storage.createMultipartUpload(key, "image/jpeg");

    const putUrl = await storage.signUploadPart(key, uploadId, 1, 60);
    const put = await PUT(
      new Request(`http://localhost${putUrl}`, { method: "PUT", body: "abc" }),
    );
    expect(put.status).toBe(200);
    const etag = put.headers.get("ETag")!;

    await storage.completeMultipartUpload(key, uploadId, [
      { partNumber: 1, etag },
    ]);
    const getUrl = await storage.signGet(key, 60);
    const res = await GET(new Request(`http://localhost${getUrl}`));
    expect(await res.text()).toBe("abc");
  });

  it("rejects unsigned and tampered requests", async () => {
    const { getStorage } = await import("@/lib/storage");
    const { GET, PUT } = await import("./route");
    const url = await getStorage().signGet("acc/med/original-1", 60);
    expect(
      (await GET(new Request("http://localhost/api/test/storage"))).status,
    ).toBe(403);
    expect(
      (
        await GET(
          new Request(
            `http://localhost${url.replace("original-1", "original-2")}`,
          ),
        )
      ).status,
    ).toBe(403);
    // A GET-signed URL must not authorise a write.
    expect(
      (
        await PUT(
          new Request(`http://localhost${url}`, { method: "PUT", body: "x" }),
        )
      ).status,
    ).toBe(403);
  });
});

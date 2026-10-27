import { describe, expect, it, vi } from "vitest";

import {
  uploadPhoto,
  UploadClientError,
  type UploadTransport,
} from "./upload-client";

const PART = 4;
const setId = "11111111-1111-4111-8111-111111111111";

function fakeTransport(overrides: Partial<UploadTransport> = {}) {
  const calls: { action: string; body: Record<string, unknown> }[] = [];
  const transport: UploadTransport = {
    async post(action, body) {
      calls.push({ action, body: body as Record<string, unknown> });
      if (action === "start")
        return { mediaId: "m1", uploadId: "u1", partSize: PART };
      if (action === "sign") return { url: "https://signed/put" };
      return { ok: true };
    },
    async putPart(_url, blob, onProgress) {
      onProgress(blob.size);
      return `"etag-${blob.size}"`;
    },
    ...overrides,
  };
  return { transport, calls };
}

const photo = (size: number, type = "image/jpeg") =>
  new File([new Uint8Array(size)], "a.jpg", { type });
const opts = () => ({
  setId,
  signal: new AbortController().signal,
  onProgress: vi.fn(),
  retryDelayMs: 0,
});

describe("uploadPhoto", () => {
  it("uploads all parts in order, reports progress and completes", async () => {
    const { transport, calls } = fakeTransport();
    const o = opts();
    const res = await uploadPhoto(photo(10), transport, o);

    expect(res).toEqual({ mediaId: "m1" });
    const complete = calls.find((c) => c.action === "complete")!;
    expect(complete.body.parts).toEqual([
      { partNumber: 1, etag: '"etag-4"' },
      { partNumber: 2, etag: '"etag-4"' },
      { partNumber: 3, etag: '"etag-2"' },
    ]);
    expect(o.onProgress).toHaveBeenLastCalledWith(10, 10);
  });

  it("retries a failed part with a fresh signature, not the whole file", async () => {
    let failed = false;
    const { transport, calls } = fakeTransport({
      async putPart(_u, blob) {
        if (!failed) {
          failed = true;
          throw new Error("network");
        }
        return `"e${blob.size}"`;
      },
    });
    await uploadPhoto(photo(6), transport, opts());
    expect(calls.filter((c) => c.action === "start")).toHaveLength(1);
    expect(calls.filter((c) => c.action === "sign")).toHaveLength(3);
    expect(calls.at(-1)!.action).toBe("complete");
  });

  it("aborts the multipart upload when a part keeps failing", async () => {
    const { transport, calls } = fakeTransport({
      putPart: async () => {
        throw new Error("down");
      },
    });
    await expect(
      uploadPhoto(photo(6), transport, opts()),
    ).rejects.toMatchObject({ code: "failed" });
    expect(calls.at(-1)).toMatchObject({
      action: "abort",
      body: { mediaId: "m1", uploadId: "u1" },
    });
  });

  it("aborts on cancel", async () => {
    const ctrl = new AbortController();
    const { transport, calls } = fakeTransport({
      async putPart() {
        ctrl.abort();
        throw new Error("aborted");
      },
    });
    await expect(
      uploadPhoto(photo(6), transport, { ...opts(), signal: ctrl.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(calls.at(-1)!.action).toBe("abort");
  });

  it("rejects unsupported types before contacting the server", async () => {
    const { transport, calls } = fakeTransport();
    await expect(
      uploadPhoto(photo(5, "image/gif"), transport, opts()),
    ).rejects.toBeInstanceOf(UploadClientError);
    expect(calls).toHaveLength(0);
  });

  it("surfaces plan limit errors from start", async () => {
    const { transport } = fakeTransport({
      async post() {
        throw new UploadClientError("plan_limit");
      },
    });
    await expect(
      uploadPhoto(photo(5), transport, opts()),
    ).rejects.toMatchObject({ code: "plan_limit" });
  });
});

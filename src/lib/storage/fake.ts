import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { assertValidKey, type Storage, type UploadedPart } from "./types";

export type FakeOp = "put-part" | "get";

/**
 * Filesystem-backed test double (shared between the web app and the worker
 * process). Signed URLs point at `/api/test/storage`, checked by `verifyFakeUrl`.
 */
export class FakeStorage implements Storage {
  constructor(
    private readonly dir: string,
    private readonly secret: string,
    private readonly baseUrl = "",
  ) {}

  private objectPath(key: string) {
    assertValidKey(key);
    return path.join(this.dir, "objects", ...key.split("/"));
  }

  private uploadDir(uploadId: string) {
    if (!/^[0-9a-f-]{36}$/.test(uploadId)) throw new Error("bad upload id");
    return path.join(this.dir, "uploads", uploadId);
  }

  private sign(op: FakeOp, key: string, extra: string, exp: number) {
    return createHmac("sha256", this.secret)
      .update([op, key, extra, exp].join("\n"))
      .digest("hex");
  }

  private url(
    op: FakeOp,
    key: string,
    extra: string,
    expiresInSeconds: number,
    query: Record<string, string> = {},
  ) {
    assertValidKey(key);
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const params = new URLSearchParams({
      op,
      key,
      extra,
      exp: String(exp),
      sig: this.sign(op, key, extra, exp),
      ...query,
    });
    return `${this.baseUrl}/api/test/storage?${params}`;
  }

  /** Validates a URL produced by this instance (used by the test route). */
  verifyUrl(params: URLSearchParams): {
    op: FakeOp;
    key: string;
    extra: string;
  } | null {
    const op = params.get("op");
    const key = params.get("key");
    const extra = params.get("extra") ?? "";
    const exp = Number(params.get("exp"));
    const sig = params.get("sig") ?? "";
    if ((op !== "put-part" && op !== "get") || !key || !Number.isFinite(exp)) {
      return null;
    }
    if (exp < Date.now() / 1000) return null;
    const expected = Buffer.from(this.sign(op, key, extra, exp));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return null;
    }
    return { op, key, extra };
  }

  async createMultipartUpload(key: string) {
    assertValidKey(key);
    const uploadId = randomUUID();
    await mkdir(this.uploadDir(uploadId), { recursive: true });
    await writeFile(path.join(this.uploadDir(uploadId), "key"), key);
    return uploadId;
  }

  async signUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds: number,
  ) {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      throw new RangeError("partNumber must be 1..10000");
    }
    return this.url(
      "put-part",
      key,
      `${uploadId}:${partNumber}`,
      expiresInSeconds,
    );
  }

  /** Stores a part and returns its ETag (what the route sends back). */
  async storePart(uploadId: string, partNumber: number, body: Buffer) {
    await writeFile(
      path.join(this.uploadDir(uploadId), `part-${partNumber}`),
      body,
    );
    return createHash("md5").update(body).digest("hex");
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[],
  ) {
    const dir = this.uploadDir(uploadId);
    const owner = await readFile(path.join(dir, "key"), "utf8").catch(
      () => null,
    );
    if (owner !== key) throw new Error("Unknown upload");
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const chunks: Buffer[] = [];
    for (const part of sorted) {
      const body = await readFile(path.join(dir, `part-${part.partNumber}`));
      const etag = createHash("md5").update(body).digest("hex");
      if (etag !== part.etag.replaceAll('"', ""))
        throw new Error("ETag mismatch");
      chunks.push(body);
    }
    await this.put(key, Buffer.concat(chunks));
    await rm(dir, { recursive: true, force: true });
  }

  async abortMultipartUpload(_key: string, uploadId: string) {
    await rm(this.uploadDir(uploadId), { recursive: true, force: true });
  }

  async signGet(
    key: string,
    expiresInSeconds: number,
    opts: { downloadName?: string } = {},
  ) {
    return this.url(
      "get",
      key,
      "",
      expiresInSeconds,
      opts.downloadName ? { name: opts.downloadName } : {},
    );
  }

  async get(key: string) {
    return readFile(this.objectPath(key));
  }

  async put(key: string, body: Buffer) {
    const file = this.objectPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async head(key: string) {
    const info = await stat(this.objectPath(key)).catch(() => null);
    return info ? { size: info.size } : null;
  }

  async delete(key: string) {
    await rm(this.objectPath(key), { force: true });
  }

  /** Test helper: all stored keys. */
  async listKeys(prefix = ""): Promise<string[]> {
    const root = path.join(this.dir, "objects");
    const out: string[] = [];
    const walk = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true }).catch(
        () => [],
      )) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else out.push(path.relative(root, full).split(path.sep).join("/"));
      }
    };
    await walk(root);
    return out.filter((k) => k.startsWith(prefix)).sort();
  }
}

import os from "node:os";
import path from "node:path";

import { serverEnv } from "@/lib/env";
import { FakeStorage } from "./fake";
import { R2Storage } from "./r2";
import type { Storage } from "./types";

const globalForStorage = globalThis as unknown as { storage?: Storage };

export function getStorage(): Storage {
  if (globalForStorage.storage) return globalForStorage.storage;
  const env = serverEnv();
  const transport =
    env.STORAGE_TRANSPORT ?? (env.R2_ACCESS_KEY_ID ? "r2" : "fake");
  if (transport === "fake") {
    if (env.NODE_ENV === "production" && env.E2E_TEST_MODE !== "1") {
      throw new Error("The fake storage must not be used in production.");
    }
    globalForStorage.storage = new FakeStorage(
      env.STORAGE_FAKE_DIR ?? path.join(os.tmpdir(), "roses-fake-storage"),
      env.AUTH_SECRET ?? "dev-only-storage-secret",
    );
  } else {
    if (
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET
    ) {
      throw new Error(
        "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET are required.",
      );
    }
    globalForStorage.storage = new R2Storage({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    });
  }
  return globalForStorage.storage;
}

export * from "./types";

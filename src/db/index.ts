import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

function createDb() {
  const client = postgres(serverEnv().DATABASE_URL, { max: 10 });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { db?: Db };

// Reuse one connection pool across hot reloads in development.
export function db(): Db {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}

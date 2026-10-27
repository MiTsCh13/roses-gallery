import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { testDatabaseUrl } from "./db-url";

export function createTestDb() {
  const client = postgres(testDatabaseUrl(), { max: 4 });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}

export type TestDb = ReturnType<typeof createTestDb>["db"];

// Wipes all tenant data; cascades through every FK chain starting at accounts.
export async function resetDb(db: TestDb) {
  await db.execute(
    sql`truncate table accounts, themes, auth_verification_tokens restart identity cascade`,
  );
}

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { SYSTEM_THEMES } from "@/lib/themes";
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
  // The truncate cascade also removes the system themes shipped by migration.
  await db
    .insert(schema.themes)
    .values(
      SYSTEM_THEMES.map((t) => ({ id: t.id, name: t.name, config: t.config })),
    );
}

/**
 * Puts every medium of the gallery's account into the gallery, in `position`
 * order (idempotent). Fixtures insert media first, then call this.
 */
export async function linkAccountMedia(db: TestDb, galleryId: string) {
  await db.execute(sql`
    insert into gallery_media (account_id, gallery_id, media_id, position)
    select m.account_id, g.id, m.id, m.position
    from media m join galleries g on g.account_id = m.account_id
    where g.id = ${galleryId}
    on conflict do nothing
  `);
}

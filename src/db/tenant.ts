import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { Db } from "./index";
import {
  deliveryMails,
  events,
  favoriteLists,
  folders,
  galleries,
  media,
  sets,
  themes,
  visitors,
} from "./schema";

type TenantTable = PgTable & { accountId: PgColumn; id?: PgColumn };

type Row<T extends TenantTable> = T["$inferSelect"];
type NewRow<T extends TenantTable> = Omit<T["$inferInsert"], "accountId">;

// Repository whose every statement is restricted to one account. The accountId
// is applied on reads, updates and deletes and forced on inserts, so callers
// cannot reach or create rows of another tenant.
function scoped<T extends TenantTable & { id: PgColumn }>(
  db: Db,
  table: T,
  accountId: string,
) {
  const own = eq(table.accountId, accountId);
  const byId = (id: string): SQL => and(own, eq(table.id, id))!;

  return {
    async list(extra?: SQL): Promise<Row<T>[]> {
      return (await db
        .select()
        .from(table as PgTable)
        .where(extra ? and(own, extra) : own)) as Row<T>[];
    },
    async get(id: string): Promise<Row<T> | undefined> {
      const rows = await db
        .select()
        .from(table as PgTable)
        .where(byId(id))
        .limit(1);
      return rows[0] as Row<T> | undefined;
    },
    async create(values: NewRow<T>): Promise<Row<T>> {
      const rows = await db
        .insert(table)
        .values({ ...values, accountId } as T["$inferInsert"])
        .returning();
      return rows[0] as Row<T>;
    },
    async update(
      id: string,
      values: Partial<NewRow<T>>,
    ): Promise<Row<T> | undefined> {
      // A tenant id in the payload must never move a row to another account.
      const { accountId: _ignored, ...safe } = values as Record<
        string,
        unknown
      >;
      void _ignored;
      const rows = await db
        .update(table)
        .set(safe as Partial<T["$inferInsert"]>)
        .where(byId(id))
        .returning();
      return rows[0] as Row<T> | undefined;
    },
    async remove(id: string): Promise<boolean> {
      const rows = await db.delete(table).where(byId(id)).returning();
      return rows.length > 0;
    },
  };
}

export function tenantDb(db: Db, accountId: string) {
  if (!accountId) throw new Error("tenantDb requires an accountId");
  return {
    accountId,
    galleries: scoped(db, galleries, accountId),
    sets: scoped(db, sets, accountId),
    folders: scoped(db, folders, accountId),
    media: scoped(db, media, accountId),
    visitors: scoped(db, visitors, accountId),
    favoriteLists: scoped(db, favoriteLists, accountId),
    events: scoped(db, events, accountId),
    deliveryMails: scoped(db, deliveryMails, accountId),
    themes: scoped(db, themes, accountId),
  };
}

export type TenantDb = ReturnType<typeof tenantDb>;

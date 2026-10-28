DROP INDEX "galleries_account_slug_idx";--> statement-breakpoint
UPDATE "galleries" g SET "slug" = left(g."slug", 50) || '-' || left(g."id"::text, 8)
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "slug" ORDER BY "created_at", "id") AS rn
  FROM "galleries"
) d
WHERE g."id" = d."id" AND d.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "galleries_slug_idx" ON "galleries" USING btree ("slug");

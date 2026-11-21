-- Sicherheitsnetz (D-146): Medien, die nur noch über ein Set einer Galerie
-- zugeordnet sind, werden vor dem Löschen der Sets in gallery_media übernommen.
INSERT INTO "gallery_media" ("account_id", "gallery_id", "media_id", "position")
SELECT m."account_id", s."gallery_id", m."id",
       COALESCE((SELECT MAX(gm."position") + 1 FROM "gallery_media" gm WHERE gm."gallery_id" = s."gallery_id"), 0)
         + (ROW_NUMBER() OVER (PARTITION BY s."gallery_id" ORDER BY s."position", m."position", m."created_at") - 1)::int
FROM "media" m
JOIN "sets" s ON s."id" = m."set_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "gallery_media" g WHERE g."gallery_id" = s."gallery_id" AND g."media_id" = m."id"
);--> statement-breakpoint
ALTER TABLE "sets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sets" CASCADE;--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_set_id_sets_id_fk";
--> statement-breakpoint
ALTER TABLE "zip_exports" DROP CONSTRAINT IF EXISTS "zip_exports_set_id_sets_id_fk";
--> statement-breakpoint
DROP INDEX "media_set_idx";--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "set_id";--> statement-breakpoint
ALTER TABLE "zip_exports" DROP COLUMN "set_id";--> statement-breakpoint
DROP TYPE "public"."set_type";
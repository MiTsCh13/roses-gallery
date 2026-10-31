CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_media" (
	"account_id" uuid NOT NULL,
	"gallery_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_media_gallery_id_media_id_pk" PRIMARY KEY("gallery_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "set_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_media" ADD CONSTRAINT "gallery_media_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_media" ADD CONSTRAINT "gallery_media_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_media" ADD CONSTRAINT "gallery_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folders_account_idx" ON "folders" USING btree ("account_id","parent_id");--> statement-breakpoint
CREATE INDEX "gallery_media_account_idx" ON "gallery_media" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "gallery_media_order_idx" ON "gallery_media" USING btree ("gallery_id","position");--> statement-breakpoint
CREATE INDEX "gallery_media_media_idx" ON "gallery_media" USING btree ("media_id");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Datenübernahme (D-142): Medien aller Sets landen in der Galerie-Reihenfolge
-- Set-Position, dann Medien-Position. Set-Titel gehen verloren.
INSERT INTO "gallery_media" ("account_id", "gallery_id", "media_id", "position")
SELECT m."account_id", s."gallery_id", m."id",
       (ROW_NUMBER() OVER (PARTITION BY s."gallery_id" ORDER BY s."position", s."created_at", m."position", m."created_at") - 1)::int
FROM "media" m
JOIN "sets" s ON s."id" = m."set_id";

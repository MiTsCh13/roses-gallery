CREATE TYPE "public"."zip_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "zip_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"gallery_id" uuid NOT NULL,
	"set_id" uuid,
	"size" text NOT NULL,
	"email" text NOT NULL,
	"status" "zip_status" DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zip_exports" ADD CONSTRAINT "zip_exports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zip_exports" ADD CONSTRAINT "zip_exports_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zip_exports" ADD CONSTRAINT "zip_exports_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "zip_exports_account_idx" ON "zip_exports" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "zip_exports_expires_idx" ON "zip_exports" USING btree ("expires_at");
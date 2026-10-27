ALTER TABLE "accounts" ADD COLUMN "subscription_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "current_period_end" timestamp with time zone;
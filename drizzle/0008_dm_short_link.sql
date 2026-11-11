ALTER TABLE "dm_auto_reply_settings" ADD COLUMN "shortSlug" varchar(40);--> statement-breakpoint
ALTER TABLE "dm_auto_reply_settings" ADD COLUMN "linkClicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dm_auto_reply_settings" ADD CONSTRAINT "dm_auto_reply_settings_shortSlug_unique" UNIQUE("shortSlug");
CREATE TABLE "comment_dm_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"automationId" integer NOT NULL,
	"igAccountId" varchar(64) NOT NULL,
	"recipientId" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"sentAt" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_comment_dm_followups_lookup" ON "comment_dm_followups" USING btree ("igAccountId","recipientId","status");
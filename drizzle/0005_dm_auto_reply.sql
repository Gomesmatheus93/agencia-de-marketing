CREATE TABLE "dm_auto_reply_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"igAccountId" varchar(64) NOT NULL,
	"senderId" varchar(64) NOT NULL,
	"ruleKey" varchar(64) NOT NULL,
	"sentAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_auto_reply_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"whatsappLink" varchar(500),
	"fallbackEnabled" boolean DEFAULT true NOT NULL,
	"fallbackMessage" text,
	"rules" json NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dm_auto_reply_settings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE INDEX "idx_dm_auto_reply_log_lookup" ON "dm_auto_reply_log" USING btree ("igAccountId","senderId","ruleKey");
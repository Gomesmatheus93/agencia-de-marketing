CREATE TABLE "ctas" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"text" varchar(300) NOT NULL,
	"category" varchar(60) NOT NULL,
	"angle" varchar(60),
	"notes" text,
	"source" varchar(16) DEFAULT 'manual' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ctas_user" ON "ctas" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ctas_user_text" ON "ctas" USING btree ("userId","text");
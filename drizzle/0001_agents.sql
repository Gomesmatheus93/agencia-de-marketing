CREATE TABLE "agent_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"path" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"threadId" integer NOT NULL,
	"role" text NOT NULL,
	"content" json NOT NULL,
	"approval" text,
	"usage" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"agentSlug" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agent_files_user_path" ON "agent_files" USING btree ("userId","path");--> statement-breakpoint
CREATE INDEX "idx_agent_messages_thread" ON "agent_messages" USING btree ("threadId");--> statement-breakpoint
CREATE INDEX "idx_agent_threads_user_agent" ON "agent_threads" USING btree ("userId","agentSlug");
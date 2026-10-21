ALTER TABLE "agent_threads" ADD COLUMN "mode" text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD COLUMN "taskInput" json;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD COLUMN "result" json;
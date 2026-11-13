CREATE TABLE "unit_support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"authorUserId" integer NOT NULL,
	"fromTeam" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"unitId" integer NOT NULL,
	"userId" integer NOT NULL,
	"subject" varchar(200) NOT NULL,
	"category" varchar(40) NOT NULL,
	"status" varchar(16) DEFAULT 'aberto' NOT NULL,
	"unreadByTeam" boolean DEFAULT true NOT NULL,
	"unreadByUnit" boolean DEFAULT false NOT NULL,
	"lastMessageAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_unit_support_msg_ticket" ON "unit_support_messages" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "idx_unit_support_unit" ON "unit_support_tickets" USING btree ("unitId");
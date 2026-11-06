CREATE TABLE "heygen_avatar_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"groupId" varchar(128) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_heygen_avatar_groups_user_group" ON "heygen_avatar_groups" USING btree ("userId","groupId");
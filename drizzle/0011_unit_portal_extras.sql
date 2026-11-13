CREATE TABLE "unit_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp with time zone,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_post_marks" (
	"unitId" integer NOT NULL,
	"weekStart" varchar(10) NOT NULL,
	"itemIndex" integer NOT NULL,
	"userId" integer NOT NULL,
	"postedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_post_marks_unitId_weekStart_itemIndex_pk" PRIMARY KEY("unitId","weekStart","itemIndex")
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "signupUrl" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "qrUrl" text;
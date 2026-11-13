CREATE TABLE "sso_used_tokens" (
	"jti" varchar(128) PRIMARY KEY NOT NULL,
	"usedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"unitId" integer,
	"kind" varchar(16) DEFAULT 'material' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"fileUrl" text NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"contentType" varchar(120) NOT NULL,
	"sizeBytes" integer DEFAULT 0 NOT NULL,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_weekly_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekStart" varchar(10) NOT NULL,
	"title" varchar(255),
	"notes" text,
	"items" json NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"publishedAt" timestamp with time zone,
	"createdByUserId" integer NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_weekly_plans_weekStart_unique" UNIQUE("weekStart")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"city" varchar(120),
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accountType" varchar(16) DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "unitId" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "externalId" varchar(128);--> statement-breakpoint
CREATE INDEX "idx_unit_materials_unitId" ON "unit_materials" USING btree ("unitId");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_externalId_unique" UNIQUE("externalId");
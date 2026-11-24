CREATE TABLE "motion_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"origin" varchar(24) DEFAULT 'modelo' NOT NULL,
	"ctaId" integer,
	"spec" json NOT NULL,
	"status" varchar(16) DEFAULT 'na_fila' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"videoUrl" text,
	"posterUrl" text,
	"seconds" integer,
	"error" text,
	"caption" text,
	"createdBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_motion_user" ON "motion_videos" USING btree ("userId");
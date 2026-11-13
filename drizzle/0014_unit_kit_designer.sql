CREATE TABLE "unit_kit_templates" (
	"format" varchar(20) PRIMARY KEY NOT NULL,
	"fields" json NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"generatedAt" timestamp with time zone,
	"generatedCount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "qrData" text;
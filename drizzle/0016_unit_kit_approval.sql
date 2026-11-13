ALTER TABLE "unit_kit_templates" ADD COLUMN "approvedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "unit_kit_templates" ADD COLUMN "approvedByUserId" integer;--> statement-breakpoint
ALTER TABLE "unit_materials" ADD COLUMN "pending" boolean DEFAULT false NOT NULL;
CREATE TABLE "user_units" (
	"userId" integer NOT NULL,
	"unitId" integer NOT NULL,
	CONSTRAINT "user_units_userId_unitId_pk" PRIMARY KEY("userId","unitId")
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "groupName" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "externalRole" varchar(40);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "groupName" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allUnits" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_user_units_unitId" ON "user_units" USING btree ("unitId");
CREATE TABLE "unit_art_backgrounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"tone" varchar(12) NOT NULL,
	"feedUrl" text NOT NULL,
	"storyUrl" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

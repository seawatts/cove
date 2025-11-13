ALTER TABLE "entities" ADD COLUMN "displayName" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "isFavorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{"syncTooltips":true}'::jsonb;--> statement-breakpoint
CREATE INDEX "entities_isFavorite_idx" ON "entities" USING btree ("isFavorite");
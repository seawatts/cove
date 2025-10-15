-- Safely drop hubs table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hubs') THEN
    ALTER TABLE "hubs" DISABLE ROW LEVEL SECURITY;
    DROP TABLE "hubs" CASCADE;
  END IF;
END $$;
--> statement-breakpoint
-- Drop old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'devices_hubId_hubs_id_fk'
    AND conrelid = 'devices'::regclass
  ) THEN
    ALTER TABLE "devices" DROP CONSTRAINT "devices_hubId_hubs_id_fk";
  END IF;
END $$;
--> statement-breakpoint
-- Add version column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'devices'
    AND column_name = 'version'
  ) THEN
    ALTER TABLE "devices" ADD COLUMN "version" text;
  END IF;
END $$;
--> statement-breakpoint
-- Add new constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'devices_hubId_devices_id_fk'
    AND conrelid = 'devices'::regclass
  ) THEN
    ALTER TABLE "devices" ADD CONSTRAINT "devices_hubId_devices_id_fk"
    FOREIGN KEY ("hubId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
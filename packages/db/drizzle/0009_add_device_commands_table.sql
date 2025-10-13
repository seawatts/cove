-- Create commandStatus enum
DO $$ BEGIN
 CREATE TYPE "public"."commandStatus" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create deviceCommands table
CREATE TABLE IF NOT EXISTS "deviceCommands" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"deviceId" varchar(128) NOT NULL,
	"capability" text NOT NULL,
	"value" json NOT NULL,
	"status" "commandStatus" DEFAULT 'pending' NOT NULL,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"processedAt" timestamp with time zone,
	"userId" varchar NOT NULL
);

-- Add foreign keys
DO $$ BEGIN
 ALTER TABLE "deviceCommands" ADD CONSTRAINT "deviceCommands_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "deviceCommands" ADD CONSTRAINT "deviceCommands_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "deviceCommands_status_idx" ON "deviceCommands" ("status");
CREATE INDEX IF NOT EXISTS "deviceCommands_deviceId_idx" ON "deviceCommands" ("deviceId");
CREATE INDEX IF NOT EXISTS "deviceCommands_createdAt_idx" ON "deviceCommands" ("createdAt");

-- Enable Realtime for deviceCommands table
ALTER PUBLICATION supabase_realtime ADD TABLE "deviceCommands";


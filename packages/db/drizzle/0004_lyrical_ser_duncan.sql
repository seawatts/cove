ALTER TYPE "public"."eventType" ADD VALUE 'state_changed';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'lock_accessed';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'lock_unlocked';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'lock_locked';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'motion_detected';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'motion_cleared';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'camera_stream_started';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'camera_stream_stopped';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'camera_motion_detected';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'sensor_threshold_exceeded';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'sensor_threshold_normal';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'device_tampered';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'battery_low';--> statement-breakpoint
ALTER TYPE "public"."eventType" ADD VALUE 'battery_critical';--> statement-breakpoint
CREATE TABLE "deviceStateHistory" (
	"attributes" json DEFAULT '{}'::json,
	"deviceId" varchar(128) NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"lastChanged" timestamp with time zone DEFAULT now() NOT NULL,
	"lastUpdated" timestamp with time zone DEFAULT now() NOT NULL,
	"state" json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deviceEvents" ADD COLUMN "stateId" varchar(128);--> statement-breakpoint
ALTER TABLE "deviceStateHistory" ADD CONSTRAINT "deviceStateHistory_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deviceStateHistory_deviceId_lastChanged_idx" ON "deviceStateHistory" USING btree ("deviceId","lastChanged");--> statement-breakpoint
CREATE INDEX "deviceStateHistory_lastChanged_idx" ON "deviceStateHistory" USING btree ("lastChanged");--> statement-breakpoint
ALTER TABLE "deviceEvents" ADD CONSTRAINT "deviceEvents_stateId_deviceStateHistory_id_fk" FOREIGN KEY ("stateId") REFERENCES "public"."deviceStateHistory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Data Migration: Convert DeviceMetrics to DeviceStateHistory
-- This migrates existing metrics to the new state history format
INSERT INTO "deviceStateHistory" ("id", "deviceId", "state", "attributes", "lastChanged", "lastUpdated")
SELECT
  "id",
  "deviceId",
  jsonb_build_object(
    "metricType", "metricType",
    "value", "value",
    "unit", COALESCE("unit", '')
  ) as "state",
  '{}'::json as "attributes",
  "timestamp" as "lastChanged",
  "timestamp" as "lastUpdated"
FROM "deviceMetrics"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Note: DeviceMetrics table is kept for now to allow for rollback
-- It will be dropped in a future migration after validation
-- To drop it manually: DROP TABLE "deviceMetrics";
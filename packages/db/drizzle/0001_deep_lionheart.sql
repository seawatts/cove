CREATE TYPE "public"."eventSeverity" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."eventType" AS ENUM('hub_started', 'hub_stopped', 'device_discovered', 'device_lost', 'device_connected', 'device_disconnected', 'adapter_initialized', 'adapter_error', 'adapter_shutdown', 'command_processed', 'command_failed', 'sync_success', 'sync_error', 'system_error', 'config_updated');--> statement-breakpoint
ALTER TYPE "public"."deviceType" ADD VALUE 'hub' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."protocolType" ADD VALUE 'hue' BEFORE 'matter';--> statement-breakpoint
CREATE TABLE "deviceEvents" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deviceId" varchar(128) NOT NULL,
	"eventType" "eventType" NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"metadata" json,
	"severity" "eventSeverity" DEFAULT 'info' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_parentRoomId_rooms_id_fk";
--> statement-breakpoint
ALTER TABLE "deviceEvents" ADD CONSTRAINT "deviceEvents_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "parentRoomId";
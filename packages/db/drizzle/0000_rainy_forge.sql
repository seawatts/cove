CREATE TYPE "public"."homeMode" AS ENUM('HOME', 'AWAY', 'SLEEP', 'VACATION', 'GUEST', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."userRole" AS ENUM('OWNER', 'ADULT', 'CHILD', 'GUEST', 'SERVICE');--> statement-breakpoint
CREATE TABLE "automation" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"homeId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automationTrace" (
	"automationId" text NOT NULL,
	"finishedAt" timestamp with time zone,
	"homeId" text NOT NULL,
	"runId" text NOT NULL,
	"spans" jsonb,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"traceId" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "traceIdUnique" UNIQUE("traceId")
);
--> statement-breakpoint
CREATE TABLE "automationVersion" (
	"automationId" text NOT NULL,
	"automationVersionId" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"graph" jsonb NOT NULL,
	"homeId" text NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "automationVersionUnique" UNIQUE("automationId","version")
);
--> statement-breakpoint
CREATE TABLE "device" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"homeId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ipAddress" "inet",
	"manufacturer" text,
	"matterNodeId" bigint,
	"metadata" jsonb,
	"model" text,
	"name" text NOT NULL,
	"roomId" text,
	"swVersion" text,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"viaDeviceId" text
);
--> statement-breakpoint
CREATE TABLE "entity" (
	"deviceId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"traits" jsonb NOT NULL,
	CONSTRAINT "entity_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "entityState" (
	"attrs" jsonb,
	"entityId" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entityStateHistory" (
	"attrs" jsonb,
	"entityId" text NOT NULL,
	"homeId" text NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"ts" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"contextId" text,
	"eventTypeId" smallint NOT NULL,
	"homeId" text NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"originIdx" smallint,
	"payloadId" bigint,
	"ts" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventPayload" (
	"body" jsonb NOT NULL,
	"hash" bigint,
	"id" bigserial PRIMARY KEY NOT NULL,
	CONSTRAINT "eventPayload_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "eventType" (
	"eventType" text NOT NULL,
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	CONSTRAINT "eventType_eventType_unique" UNIQUE("eventType")
);
--> statement-breakpoint
CREATE TABLE "floor" (
	"homeId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"index" integer NOT NULL,
	"name" text,
	CONSTRAINT "floorUnique" UNIQUE("homeId","index")
);
--> statement-breakpoint
CREATE TABLE "home" (
	"address" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mode" (
	"homeId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" "homeMode" NOT NULL,
	"policy" jsonb,
	CONSTRAINT "modeUnique" UNIQUE("homeId","key")
);
--> statement-breakpoint
CREATE TABLE "room" (
	"floorId" text,
	"homeId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roomUnique" UNIQUE("homeId","name")
);
--> statement-breakpoint
CREATE TABLE "scene" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" text,
	"homeId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sceneVersion" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"homeId" text NOT NULL,
	"note" text,
	"sceneId" text NOT NULL,
	"sceneVersionId" text PRIMARY KEY NOT NULL,
	"steps" jsonb NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "sceneVersionUnique" UNIQUE("sceneId","version")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"firstName" text,
	"homeId" text,
	"id" text PRIMARY KEY NOT NULL,
	"imageUrl" text,
	"lastName" text,
	"role" "userRole" DEFAULT 'ADULT' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "automation" ADD CONSTRAINT "automation_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation" ADD CONSTRAINT "automation_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automationTrace" ADD CONSTRAINT "automationTrace_automationId_automation_id_fk" FOREIGN KEY ("automationId") REFERENCES "public"."automation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automationTrace" ADD CONSTRAINT "automationTrace_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automationVersion" ADD CONSTRAINT "automationVersion_automationId_automation_id_fk" FOREIGN KEY ("automationId") REFERENCES "public"."automation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automationVersion" ADD CONSTRAINT "automationVersion_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_roomId_room_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_viaDeviceId_device_id_fk" FOREIGN KEY ("viaDeviceId") REFERENCES "public"."device"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_deviceId_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entityState" ADD CONSTRAINT "entityState_entityId_entity_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entityStateHistory" ADD CONSTRAINT "entityStateHistory_entityId_entity_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entityStateHistory" ADD CONSTRAINT "entityStateHistory_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_eventTypeId_eventType_id_fk" FOREIGN KEY ("eventTypeId") REFERENCES "public"."eventType"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_payloadId_eventPayload_id_fk" FOREIGN KEY ("payloadId") REFERENCES "public"."eventPayload"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floor" ADD CONSTRAINT "floor_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home" ADD CONSTRAINT "home_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mode" ADD CONSTRAINT "mode_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_floorId_floor_id_fk" FOREIGN KEY ("floorId") REFERENCES "public"."floor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene" ADD CONSTRAINT "scene_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene" ADD CONSTRAINT "scene_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sceneVersion" ADD CONSTRAINT "sceneVersion_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sceneVersion" ADD CONSTRAINT "sceneVersion_sceneId_scene_id_fk" FOREIGN KEY ("sceneId") REFERENCES "public"."scene"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_homeId_home_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."home"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_homeId_idx" ON "device" USING btree ("homeId");--> statement-breakpoint
CREATE INDEX "device_roomId_idx" ON "device" USING btree ("roomId");--> statement-breakpoint
CREATE INDEX "device_matterNodeId_idx" ON "device" USING btree ("matterNodeId");--> statement-breakpoint
CREATE INDEX "device_updatedAt_idx" ON "device" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "entity_deviceId_idx" ON "entity" USING btree ("deviceId");--> statement-breakpoint
CREATE INDEX "entity_kind_idx" ON "entity" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "entityStateHistory_entityId_ts_idx" ON "entityStateHistory" USING btree ("entityId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entityStateHistory_homeId_ts_idx" ON "entityStateHistory" USING btree ("homeId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entityStateHistory_ts_idx" ON "entityStateHistory" USING btree ("ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "event_homeId_ts_idx" ON "event" USING btree ("homeId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "event_eventTypeId_ts_idx" ON "event" USING btree ("eventTypeId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "event_ts_idx" ON "event" USING btree ("ts" DESC NULLS LAST);

-- ===================================
-- TimescaleDB Setup
-- ===================================

-- TimescaleDB Community License
-- Free for use in applications that are not time-series databases themselves.
-- See: https://github.com/timescale/timescaledb/blob/main/tsl/LICENSE-TIMESCALE
-- This license allows:
-- ✓ Self-hosted deployments
-- ✓ SaaS applications using TimescaleDB
-- ✓ Commercial use
-- Does NOT allow:
-- ✗ Offering TimescaleDB itself as a paid service
-- ✗ Building competing time-series database products

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Drop the primary key constraint temporarily to create hypertable
ALTER TABLE "entityStateHistory" DROP CONSTRAINT "entityStateHistory_pkey";

-- Turn history table into a hypertable (time column = ts)
-- This is the core TimescaleDB feature that provides automatic time-based partitioning
SELECT create_hypertable('"entityStateHistory"', 'ts', if_not_exists => TRUE);

-- Add back the primary key constraint with ts column included (required for hypertables)
ALTER TABLE "entityStateHistory" ADD CONSTRAINT "entityStateHistory_pkey" PRIMARY KEY (id, ts);

-- Note: Compression, retention policies, and continuous aggregates require TimescaleDB Community License
-- These features are not available with the Apache license used in local Supabase development
-- For production deployment, consider using TimescaleDB Community License or Timescale Cloud
--
-- To enable these features in production, uncomment the following sections:
--
-- Compression and retention policies (TimescaleDB Community features)
-- ALTER TABLE "entityStateHistory" SET (
--   timescaledb.compress,
--   timescaledb.compress_segmentby = 'entityId',
--   timescaledb.compress_orderby = 'ts DESC'
-- );
-- SELECT add_compression_policy('"entityStateHistory"', INTERVAL '7 days');
-- SELECT add_retention_policy('"entityStateHistory"', INTERVAL '90 days');
--
-- Continuous aggregates for time-series analytics
-- CREATE MATERIALIZED VIEW entity_state_1min WITH (timescaledb.continuous) AS ...
-- CREATE MATERIALIZED VIEW entity_state_5min WITH (timescaledb.continuous) AS ...
-- CREATE MATERIALIZED VIEW entity_state_hourly WITH (timescaledb.continuous) AS ...
-- CREATE MATERIALIZED VIEW entity_state_daily WITH (timescaledb.continuous) AS ...
CREATE TYPE "public"."entityKind" AS ENUM('alarm_control_panel', 'binary_sensor', 'button', 'camera', 'climate', 'color', 'cover', 'date', 'datetime', 'event', 'fan', 'light', 'lock', 'media_player', 'number', 'outlet', 'select', 'sensor', 'siren', 'speaker', 'switch', 'text', 'text_sensor', 'thermostat', 'time', 'update', 'valve', 'other');--> statement-breakpoint
CREATE TYPE "public"."userRole" AS ENUM('OWNER', 'ADULT', 'CHILD', 'GUEST', 'SERVICE');--> statement-breakpoint
CREATE TABLE "devices" (
	"available" boolean DEFAULT true NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"configUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"disabledBy" text,
	"entryType" text DEFAULT 'device',
	"externalId" text,
	"homeId" text NOT NULL,
	"hostname" text,
	"hwVersion" text,
	"id" text PRIMARY KEY NOT NULL,
	"ipAddress" "inet",
	"lastSeen" timestamp with time zone,
	"macAddress" text,
	"manufacturer" text,
	"matterNodeId" bigint,
	"metadata" jsonb,
	"model" text,
	"name" text NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"port" integer,
	"protocol" text NOT NULL,
	"roomId" text,
	"swVersion" text,
	"type" text,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"viaDeviceId" text
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deviceClass" text,
	"deviceId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" "entityKind" NOT NULL,
	"name" text,
	CONSTRAINT "entities_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "entityStateHistories" (
	"attrs" jsonb,
	"entityId" text NOT NULL,
	"homeId" text NOT NULL,
	"id" bigserial NOT NULL,
	"state" text NOT NULL,
	"ts" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entityStates" (
	"attrs" jsonb,
	"entityId" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"deviceId" text,
	"entityId" text,
	"eventType" text NOT NULL,
	"homeId" text NOT NULL,
	"id" bigserial NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"ts" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homes" (
	"address" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdBy" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"floor" integer,
	"homeId" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roomUnique" UNIQUE("homeId","name")
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
ALTER TABLE "devices" ADD CONSTRAINT "devices_homeId_homes_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_roomId_rooms_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_viaDeviceId_devices_id_fk" FOREIGN KEY ("viaDeviceId") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entityStateHistories" ADD CONSTRAINT "entityStateHistories_entityId_entities_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entityStateHistories" ADD CONSTRAINT "entityStateHistories_homeId_homes_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entityStates" ADD CONSTRAINT "entityStates_entityId_entities_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_entityId_entities_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_homeId_homes_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homes" ADD CONSTRAINT "homes_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_homeId_homes_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_homeId_homes_id_fk" FOREIGN KEY ("homeId") REFERENCES "public"."homes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_homeId_idx" ON "devices" USING btree ("homeId");--> statement-breakpoint
CREATE INDEX "devices_roomId_idx" ON "devices" USING btree ("roomId");--> statement-breakpoint
CREATE INDEX "devices_matterNodeId_idx" ON "devices" USING btree ("matterNodeId");--> statement-breakpoint
CREATE INDEX "devices_updatedAt_idx" ON "devices" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "devices_protocol_idx" ON "devices" USING btree ("protocol");--> statement-breakpoint
CREATE INDEX "devices_externalId_idx" ON "devices" USING btree ("externalId");--> statement-breakpoint
CREATE INDEX "devices_type_idx" ON "devices" USING btree ("type");--> statement-breakpoint
CREATE INDEX "devices_macAddress_idx" ON "devices" USING btree ("macAddress");--> statement-breakpoint
CREATE INDEX "devices_online_idx" ON "devices" USING btree ("online");--> statement-breakpoint
CREATE INDEX "devices_available_idx" ON "devices" USING btree ("available");--> statement-breakpoint
CREATE INDEX "entities_deviceId_idx" ON "entities" USING btree ("deviceId");--> statement-breakpoint
CREATE INDEX "entities_kind_idx" ON "entities" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "entities_deviceClass_idx" ON "entities" USING btree ("deviceClass");--> statement-breakpoint
CREATE INDEX "entityStateHistories_entityId_ts_idx" ON "entityStateHistories" USING btree ("entityId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entityStateHistories_homeId_ts_idx" ON "entityStateHistories" USING btree ("homeId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entityStateHistories_ts_idx" ON "entityStateHistories" USING btree ("ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_homeId_ts_idx" ON "events" USING btree ("homeId","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_eventType_ts_idx" ON "events" USING btree ("eventType","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_ts_idx" ON "events" USING btree ("ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_entityId_idx" ON "events" USING btree ("entityId");--> statement-breakpoint
CREATE INDEX "events_deviceId_idx" ON "events" USING btree ("deviceId");
-- Create the requesting_user_id function as per Clerk docs
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text;
$$;--> statement-breakpoint

-- Create the requesting_org_id function for consistency
CREATE OR REPLACE FUNCTION requesting_org_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'org_id',
    ''
  )::text;
$$;--> statement-breakpoint


CREATE TYPE "public"."apiKeyUsageType" AS ENUM('mcp-server');--> statement-breakpoint
CREATE TYPE "public"."commandStatus" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deviceCapability" AS ENUM('on_off', 'brightness', 'color_temperature', 'color_rgb', 'temperature', 'humidity', 'air_quality', 'co2', 'pressure', 'motion', 'occupancy', 'contact_sensor', 'battery', 'power_consumption', 'voltage', 'lock', 'unlock', 'audio_volume', 'audio_playback', 'video_stream', 'fan_speed', 'heating', 'cooling', 'target_temperature', 'custom');--> statement-breakpoint
CREATE TYPE "public"."deviceType" AS ENUM('light', 'switch', 'sensor', 'thermostat', 'lock', 'camera', 'speaker', 'fan', 'outlet', 'other');--> statement-breakpoint
CREATE TYPE "public"."localConnectionStatus" AS ENUM('connected', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."protocolType" AS ENUM('esphome', 'matter', 'zigbee', 'zwave', 'wifi', 'bluetooth', 'mqtt', 'http');--> statement-breakpoint
CREATE TYPE "public"."stripeSubscriptionStatus" AS ENUM('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'paused', 'trialing', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."userRole" AS ENUM('admin', 'superAdmin', 'user');--> statement-breakpoint
CREATE TABLE "apiKeyUsage" (
	"apiKeyId" varchar(128) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"metadata" json,
	"orgId" varchar DEFAULT requesting_org_id() NOT NULL,
	"type" "apiKeyUsageType" NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apiKeys" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"key" text NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"name" text NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id() NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL,
	CONSTRAINT "apiKeys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "authCodes" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id() NOT NULL,
	"sessionId" text NOT NULL,
	"updatedAt" timestamp with time zone,
	"usedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"actions" json NOT NULL,
	"conditions" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"lastTriggered" timestamp with time zone,
	"name" text NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id(),
	"trigger" json NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deviceCommands" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"deviceId" varchar(128) NOT NULL,
	"capability" text NOT NULL,
	"value" json NOT NULL,
	"status" "commandStatus" DEFAULT 'pending' NOT NULL,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"processedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deviceMetrics" (
	"deviceId" varchar(128) NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"metricType" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"unit" text,
	"value" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"available" boolean DEFAULT true NOT NULL,
	"capabilities" json DEFAULT '[]'::json NOT NULL,
	"config" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deviceType" "deviceType" NOT NULL,
	"hubId" varchar(128),
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"ipAddress" text,
	"lastSeen" timestamp with time zone,
	"macAddress" text,
	"name" text NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id(),
	"protocol" "protocolType",
	"roomId" varchar(128),
	"state" json DEFAULT '{}'::json NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hubs" (
	"config" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"ipAddress" text,
	"lastSeen" timestamp with time zone,
	"macAddress" text,
	"name" text NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id(),
	"systemInfo" json,
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL,
	"version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgMembers" (
	"createdAt" timestamp with time zone DEFAULT now(),
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id() NOT NULL,
	"role" "userRole" DEFAULT 'user' NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL,
	CONSTRAINT "orgMembers_userId_orgId_unique" UNIQUE("userId","orgId")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"clerkOrgId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"createdByUserId" varchar NOT NULL,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"stripeSubscriptionStatus" "stripeSubscriptionStatus",
	"updatedAt" timestamp with time zone,
	CONSTRAINT "orgs_clerkOrgId_unique" UNIQUE("clerkOrgId"),
	CONSTRAINT "orgs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"automationsEnabled" boolean DEFAULT true NOT NULL,
	"color" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"floor" json,
	"icon" text,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id(),
	"parentRoomId" varchar(128),
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"actions" json NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"icon" text,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"lastActivated" timestamp with time zone,
	"name" text NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id(),
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shortUrls" (
	"code" varchar(128) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"expiresAt" timestamp with time zone,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"orgId" varchar DEFAULT requesting_org_id() NOT NULL,
	"redirectUrl" text NOT NULL,
	"updatedAt" timestamp with time zone,
	"userId" varchar DEFAULT requesting_user_id() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"avatarUrl" text,
	"clerkId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"firstName" text,
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"lastLoggedInAt" timestamp with time zone,
	"lastName" text,
	"online" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "user_clerkId_unique" UNIQUE("clerkId")
);
--> statement-breakpoint
ALTER TABLE "apiKeyUsage" ADD CONSTRAINT "apiKeyUsage_apiKeyId_apiKeys_id_fk" FOREIGN KEY ("apiKeyId") REFERENCES "public"."apiKeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiKeyUsage" ADD CONSTRAINT "apiKeyUsage_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiKeyUsage" ADD CONSTRAINT "apiKeyUsage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiKeys" ADD CONSTRAINT "apiKeys_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiKeys" ADD CONSTRAINT "apiKeys_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authCodes" ADD CONSTRAINT "authCodes_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authCodes" ADD CONSTRAINT "authCodes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deviceCommands" ADD CONSTRAINT "deviceCommands_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deviceCommands" ADD CONSTRAINT "deviceCommands_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deviceMetrics" ADD CONSTRAINT "deviceMetrics_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_hubId_hubs_id_fk" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_roomId_rooms_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgMembers" ADD CONSTRAINT "orgMembers_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgMembers" ADD CONSTRAINT "orgMembers_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_parentRoomId_rooms_id_fk" FOREIGN KEY ("parentRoomId") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortUrls" ADD CONSTRAINT "shortUrls_orgId_orgs_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortUrls" ADD CONSTRAINT "shortUrls_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TYPE "public"."protocolType" ADD VALUE 'sonos' BEFORE 'zigbee';--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "host" text;
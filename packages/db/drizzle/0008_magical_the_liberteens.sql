DROP INDEX "devices_ipAddress_protocol_idx";--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "externalId" text NOT NULL;--> statement-breakpoint
CREATE INDEX "devices_ipAddress_idx" ON "devices" USING btree ("ipAddress");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_externalId_unique" UNIQUE("externalId");
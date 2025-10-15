CREATE INDEX "devices_macAddress_idx" ON "devices" USING btree ("macAddress");--> statement-breakpoint
CREATE INDEX "devices_ipAddress_protocol_idx" ON "devices" USING btree ("ipAddress","protocol");
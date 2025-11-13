CREATE TABLE "hubs" (
	"cloudUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"lastSeen" timestamp with time zone,
	"localUrl" text NOT NULL,
	"name" text NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"ownerId" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"version" text
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "hubId" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "hubId" text;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "hubId" text;--> statement-breakpoint
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hubs_ownerId_idx" ON "hubs" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "hubs_online_idx" ON "hubs" USING btree ("online");--> statement-breakpoint
CREATE INDEX "hubs_lastSeen_idx" ON "hubs" USING btree ("lastSeen");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_hubId_hubs_id_fk" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_hubId_hubs_id_fk" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hubId_hubs_id_fk" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_hubId_idx" ON "devices" USING btree ("hubId");--> statement-breakpoint
CREATE INDEX "entities_hubId_idx" ON "entities" USING btree ("hubId");--> statement-breakpoint
CREATE INDEX "rooms_hubId_idx" ON "rooms" USING btree ("hubId");
CREATE TABLE `telemetryConfig` (
	`changeThreshold` integer,
	`entityId` text NOT NULL,
	`field` text,
	`minimumInterval` integer,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`entityId`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telemetryConfig_entityId_idx` ON `telemetryConfig` (`entityId`);--> statement-breakpoint
CREATE UNIQUE INDEX `telemetryConfig_entityId_field` ON `telemetryConfig` (`entityId`,`field`);
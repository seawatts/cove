CREATE TABLE `alertConfigs` (
	`alertType` text NOT NULL,
	`createdAt` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`entityId` text NOT NULL,
	`field` text NOT NULL,
	`homeId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rangeMax` integer,
	`rangeMin` integer,
	`rateThreshold` integer,
	`rateWindow` integer,
	`severity` text NOT NULL,
	`thresholdOperator` text,
	`thresholdValue` integer,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`entityId`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`homeId`) REFERENCES `homes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alertConfigs_entityId_idx` ON `alertConfigs` (`entityId`);--> statement-breakpoint
CREATE INDEX `alertConfigs_homeId_idx` ON `alertConfigs` (`homeId`);--> statement-breakpoint
CREATE INDEX `alertConfigs_enabled_idx` ON `alertConfigs` (`enabled`);--> statement-breakpoint
CREATE INDEX `alertConfigs_severity_idx` ON `alertConfigs` (`severity`);--> statement-breakpoint
CREATE TABLE `alertHistory` (
	`acknowledged` integer DEFAULT false NOT NULL,
	`alertConfigId` text NOT NULL,
	`entityId` text NOT NULL,
	`homeId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`resolvedAt` integer,
	`severity` text NOT NULL,
	`threshold` integer,
	`triggeredAt` integer NOT NULL,
	`value` integer NOT NULL,
	FOREIGN KEY (`alertConfigId`) REFERENCES `alertConfigs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entityId`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`homeId`) REFERENCES `homes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alertHistory_alertConfigId_idx` ON `alertHistory` (`alertConfigId`);--> statement-breakpoint
CREATE INDEX `alertHistory_entityId_idx` ON `alertHistory` (`entityId`);--> statement-breakpoint
CREATE INDEX `alertHistory_homeId_idx` ON `alertHistory` (`homeId`);--> statement-breakpoint
CREATE INDEX `alertHistory_triggeredAt_idx` ON `alertHistory` (`triggeredAt`);--> statement-breakpoint
CREATE INDEX `alertHistory_severity_idx` ON `alertHistory` (`severity`);--> statement-breakpoint
CREATE INDEX `alertHistory_acknowledged_idx` ON `alertHistory` (`acknowledged`);--> statement-breakpoint
CREATE INDEX `alertHistory_resolvedAt_idx` ON `alertHistory` (`resolvedAt`);
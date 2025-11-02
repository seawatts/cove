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
	`showInGraph` integer DEFAULT true NOT NULL,
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
CREATE INDEX `alertHistory_resolvedAt_idx` ON `alertHistory` (`resolvedAt`);--> statement-breakpoint
CREATE TABLE `credentials` (
	`blob` blob NOT NULL,
	`deviceId` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`bridgeId` text,
	`fingerprint` text,
	`homeId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`ip` text,
	`lastSeen` integer,
	`model` text,
	`name` text,
	`pairedAt` integer,
	`protocol` text NOT NULL,
	`roomId` text,
	`vendor` text NOT NULL,
	FOREIGN KEY (`homeId`) REFERENCES `homes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_fingerprint_unique` ON `devices` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `devices_protocol_idx` ON `devices` (`protocol`);--> statement-breakpoint
CREATE INDEX `devices_fingerprint_idx` ON `devices` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `devices_homeId_idx` ON `devices` (`homeId`);--> statement-breakpoint
CREATE INDEX `devices_roomId_idx` ON `devices` (`roomId`);--> statement-breakpoint
CREATE INDEX `devices_lastSeen_idx` ON `devices` (`lastSeen`);--> statement-breakpoint
CREATE TABLE `entities` (
	`capability` blob NOT NULL,
	`deviceClass` text,
	`deviceId` text NOT NULL,
	`displayName` text,
	`homeId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`key` text,
	`kind` text NOT NULL,
	`name` text,
	FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`homeId`) REFERENCES `homes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entities_deviceId_idx` ON `entities` (`deviceId`);--> statement-breakpoint
CREATE INDEX `entities_homeId_idx` ON `entities` (`homeId`);--> statement-breakpoint
CREATE INDEX `entities_key_idx` ON `entities` (`key`);--> statement-breakpoint
CREATE INDEX `entities_kind_idx` ON `entities` (`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `entityDeviceName` ON `entities` (`deviceId`,`name`);--> statement-breakpoint
CREATE TABLE `entityState` (
	`entityId` text PRIMARY KEY NOT NULL,
	`state` blob NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`entityId`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `homes` (
	`address` blob,
	`createdAt` integer NOT NULL,
	`createdBy` text,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`floor` integer,
	`homeId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`homeId`) REFERENCES `homes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roomUnique` ON `rooms` (`homeId`,`name`);--> statement-breakpoint
CREATE TABLE `telemetry` (
	`entityId` text NOT NULL,
	`field` text NOT NULL,
	`homeId` text NOT NULL,
	`ts` integer NOT NULL,
	`unit` text,
	`value` integer,
	FOREIGN KEY (`entityId`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`homeId`) REFERENCES `homes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telemetry_entityId_ts_field` ON `telemetry` (`entityId`,`ts`,`field`);--> statement-breakpoint
CREATE INDEX `telemetry_homeId_idx` ON `telemetry` (`homeId`);--> statement-breakpoint
CREATE INDEX `telemetry_ts_idx` ON `telemetry` (`ts`);--> statement-breakpoint
CREATE INDEX `telemetry_field_idx` ON `telemetry` (`field`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `telemetryConfig_entityId_field` ON `telemetryConfig` (`entityId`,`field`);--> statement-breakpoint
CREATE TABLE `users` (
	`createdAt` integer NOT NULL,
	`email` text NOT NULL,
	`firstName` text,
	`homeId` text,
	`id` text PRIMARY KEY NOT NULL,
	`imageUrl` text,
	`lastName` text,
	`role` text DEFAULT 'ADULT' NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`homeId`) REFERENCES `homes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
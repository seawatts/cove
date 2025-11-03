ALTER TABLE `entities` ADD `isFavorite` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `entities_isFavorite_idx` ON `entities` (`isFavorite`);
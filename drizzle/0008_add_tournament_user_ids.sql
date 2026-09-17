ALTER TABLE `tournaments` ADD COLUMN `owner_user_id` text;
--> statement-breakpoint
ALTER TABLE `tournament_entries` ADD COLUMN `user_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_entries_user_round_idx` ON `tournament_entries` (`tournament_id`, `user_id`, `round`);

CREATE TABLE `tournament_entries` (`id` text PRIMARY KEY NOT NULL, `tournament_id` text NOT NULL, `nickname` text NOT NULL, `round` integer NOT NULL, `joined` integer DEFAULT true NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX `tournament_entries_unique` ON `tournament_entries` (`tournament_id`, `nickname`, `round`);

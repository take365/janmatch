CREATE TABLE `discord_tournament_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `guild_id` text,
  `channel_id` text NOT NULL,
  `discord_user_id` text NOT NULL,
  `data_json` text NOT NULL,
  `status` text NOT NULL DEFAULT 'draft',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_tournament_drafts_owner_idx` ON `discord_tournament_drafts` (`channel_id`, `discord_user_id`, `status`);

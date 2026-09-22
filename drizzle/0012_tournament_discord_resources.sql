CREATE TABLE `tournament_discord_resources` (
  `tournament_id` text PRIMARY KEY NOT NULL,
  `guild_id` text NOT NULL,
  `role_id` text,
  `channel_id` text,
  `announcement_channel_id` text,
  `announcement_message_id` text,
  `scheduled_event_id` text,
  `provision_status` text NOT NULL DEFAULT 'draft',
  `last_error` text NOT NULL DEFAULT '',
  `retry_at` text,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `tournament_discord_resources_status_idx` ON `tournament_discord_resources` (`provision_status`, `retry_at`);

CREATE TABLE `users_new` (
  `id` text PRIMARY KEY NOT NULL,
  `discord_user_id` text NOT NULL UNIQUE,
  `discord_username` text NOT NULL DEFAULT '',
  `discord_nickname` text NOT NULL DEFAULT '',
  `nickname` text NOT NULL DEFAULT '',
  `game_name` text NOT NULL DEFAULT '',
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `users_new` (`id`, `discord_user_id`, `discord_username`, `discord_nickname`, `nickname`, `game_name`, `created_at`, `updated_at`)
SELECT `discord_user_id`, `discord_user_id`, `discord_username`, `discord_nickname`, `nickname`, `game_name`, `created_at`, `updated_at` FROM `users`;
--> statement-breakpoint
UPDATE `auth_sessions` SET `user_id` = (SELECT `discord_user_id` FROM `users` WHERE `users`.`id` = `auth_sessions`.`user_id`) WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `auth_sessions`.`user_id`);
--> statement-breakpoint
UPDATE `tournaments` SET `owner_user_id` = (SELECT `discord_user_id` FROM `users` WHERE `users`.`id` = `tournaments`.`owner_user_id`) WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `tournaments`.`owner_user_id`);
--> statement-breakpoint
UPDATE `tournament_entries` SET `user_id` = (SELECT `discord_user_id` FROM `users` WHERE `users`.`id` = `tournament_entries`.`user_id`) WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `tournament_entries`.`user_id`);
--> statement-breakpoint
UPDATE `profiles` SET `session_id` = (SELECT `discord_user_id` FROM `users` WHERE `users`.`id` = `profiles`.`session_id`) WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `profiles`.`session_id`);
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
ALTER TABLE `users_new` RENAME TO `users`;
--> statement-breakpoint
ALTER TABLE `tournaments` ADD COLUMN `discord_channel_id` text;
--> statement-breakpoint
CREATE TABLE `operation_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `interaction_id` text UNIQUE,
  `actor_user_id` text,
  `actor_discord_user_id` text NOT NULL,
  `guild_id` text,
  `channel_id` text,
  `operation_type` text NOT NULL,
  `status` text NOT NULL,
  `reason` text NOT NULL DEFAULT '',
  `before_summary` text NOT NULL DEFAULT '',
  `after_summary` text NOT NULL DEFAULT '',
  `error_message` text NOT NULL DEFAULT '',
  `confirmation_token` text UNIQUE,
  `confirmation_expires_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `completed_at` text
);
--> statement-breakpoint
CREATE INDEX `operation_requests_actor_idx` ON `operation_requests` (`actor_discord_user_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `agent_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `tournament_id` text,
  `channel_id` text NOT NULL,
  `discord_user_id` text NOT NULL,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `interaction_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_messages_channel_idx` ON `agent_messages` (`channel_id`, `created_at`);

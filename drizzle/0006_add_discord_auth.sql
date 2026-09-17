CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `discord_user_id` text NOT NULL UNIQUE,
  `discord_username` text NOT NULL DEFAULT '',
  `nickname` text NOT NULL DEFAULT '',
  `game_name` text NOT NULL DEFAULT '',
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `expires_at` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
  `state_hash` text PRIMARY KEY NOT NULL,
  `expires_at` text NOT NULL
);

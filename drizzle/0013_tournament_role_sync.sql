CREATE TABLE `tournament_role_sync` (
  `tournament_id` text NOT NULL,
  `user_id` text NOT NULL,
  `desired_state` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `last_error` text NOT NULL DEFAULT '',
  `retry_at` text,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tournament_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `tournament_role_sync_retry_idx` ON `tournament_role_sync` (`status`, `retry_at`);

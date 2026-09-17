CREATE TABLE `tournament_notifications` (
  `event_key` text PRIMARY KEY NOT NULL,
  `tournament_id` text NOT NULL,
  `round` integer,
  `event_type` text NOT NULL,
  `sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `tournament_notifications_tournament_idx` ON `tournament_notifications` (`tournament_id`);

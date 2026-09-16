CREATE TABLE `tournaments` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `name` text NOT NULL,
  `game_type` text NOT NULL,
  `start_at` text NOT NULL,
  `password` text NOT NULL,
  `rounds` integer NOT NULL,
  `pairing_mode` text NOT NULL,
  `uma` text NOT NULL,
  `notice` text DEFAULT '' NOT NULL,
  `phase` text DEFAULT 'before' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

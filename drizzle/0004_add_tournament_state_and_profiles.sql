CREATE TABLE `tournament_rounds` (
	`tournament_id` text NOT NULL,
	`round` integer NOT NULL,
	`status` text DEFAULT '受付前' NOT NULL,
	`state_json` text DEFAULT '{"tables":[]}' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`tournament_id`, `round`)
);
--> statement-breakpoint
CREATE INDEX `tournament_rounds_tournament_idx` ON `tournament_rounds` (`tournament_id`);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`session_id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`game_name` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
WITH RECURSIVE round_numbers(round) AS (
	SELECT 1
	UNION ALL
	SELECT round + 1 FROM round_numbers WHERE round < 20
)
INSERT INTO `tournament_rounds` (`tournament_id`, `round`, `status`, `state_json`, `version`)
SELECT `t`.`id`, `r`.`round`, '受付前', '{"tables":[]}', 0
FROM `tournaments` AS `t`
JOIN round_numbers AS `r` ON r.round <= t.rounds;

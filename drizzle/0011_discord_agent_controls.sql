ALTER TABLE `operation_requests` ADD COLUMN `arguments_json` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `operation_requests` ADD COLUMN `actor_roles_json` text NOT NULL DEFAULT '[]';

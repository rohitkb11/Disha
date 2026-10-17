CREATE TABLE `pilot_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`check_id` text NOT NULL,
	`status` text NOT NULL,
	`evidence` text NOT NULL,
	`actor_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_pilot_check` ON `pilot_checks` (`workspace_id`,`check_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `provider_payment_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_payment_id_unique` ON `payments` (`provider_payment_id`);
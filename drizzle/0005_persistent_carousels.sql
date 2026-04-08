CREATE TABLE IF NOT EXISTS `carousels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topic` varchar(512) NOT NULL,
	`style` varchar(100) NOT NULL,
	`hook` text NOT NULL,
	`caption` text NOT NULL,
	`finalCta` text NOT NULL,
	`coverImageUrl` text,
	`slides` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carousels_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `editorial_plan_items` (
	`id` int NOT NULL AUTO_INCREMENT,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`scheduledDate` varchar(10) NOT NULL,
	`format` varchar(32) NOT NULL,
	`category` varchar(255) NOT NULL,
	`suggestedTitle` varchar(512) NOT NULL,
	`pauta` text NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`socialPostId` int,
	`contentType` varchar(20),
	`contentId` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `editorial_plan_items_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_editorial_plan_userId_month` ON `editorial_plan_items` (`userId`,`year`,`month`);

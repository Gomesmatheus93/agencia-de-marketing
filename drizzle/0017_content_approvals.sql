CREATE TABLE IF NOT EXISTS `content_approvals` (
	`id` int NOT NULL AUTO_INCREMENT,
	`token` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`contentType` enum('article','carousel') NOT NULL,
	`contentId` int NOT NULL,
	`clientName` varchar(255),
	`status` enum('pending','approved','changes_requested') NOT NULL DEFAULT 'pending',
	`clientComment` text,
	`respondedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `content_approvals_pk` PRIMARY KEY(`id`),
	CONSTRAINT `content_approvals_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `idx_content_approvals_userId` ON `content_approvals` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_content_approvals_content` ON `content_approvals` (`contentType`,`contentId`);

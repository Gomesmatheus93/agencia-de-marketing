-- Analytics: video/reels history columns on post_metrics + new daily account insights snapshot

ALTER TABLE `post_metrics`
  ADD COLUMN IF NOT EXISTS `impressions` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `videoViews` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `avgWatchTimeMs` int NOT NULL DEFAULT 0;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `instagram_account_insights_daily` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `dateKey` varchar(10) NOT NULL,
  `collectedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `demographics` json,
  `websiteClicks` int NOT NULL DEFAULT 0,
  `phoneCallClicks` int NOT NULL DEFAULT 0,
  `emailContacts` int NOT NULL DEFAULT 0,
  `textMessageClicks` int NOT NULL DEFAULT 0,
  `getDirectionsClicks` int NOT NULL DEFAULT 0,
  `totalInteractions` int NOT NULL DEFAULT 0,
  `accountsEngaged` int NOT NULL DEFAULT 0,
  CONSTRAINT `instagram_account_insights_daily_id` PRIMARY KEY(`id`),
  INDEX `idx_ig_account_insights_userId` (`userId`),
  CONSTRAINT `uq_ig_account_insights_user_date` UNIQUE (`userId`, `dateKey`)
);

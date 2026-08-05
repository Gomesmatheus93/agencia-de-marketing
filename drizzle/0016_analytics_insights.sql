-- Analytics: video/reels history columns on post_metrics + new daily account insights snapshot
-- Rewritten for MySQL 5.7 compatibility (ADD COLUMN IF NOT EXISTS not supported before 8.0.3)

DROP PROCEDURE IF EXISTS `__migr_0016_add_cols`;
--> statement-breakpoint
CREATE PROCEDURE `__migr_0016_add_cols`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post_metrics' AND COLUMN_NAME = 'impressions'
  ) THEN
    ALTER TABLE `post_metrics` ADD COLUMN `impressions` int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post_metrics' AND COLUMN_NAME = 'videoViews'
  ) THEN
    ALTER TABLE `post_metrics` ADD COLUMN `videoViews` int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post_metrics' AND COLUMN_NAME = 'avgWatchTimeMs'
  ) THEN
    ALTER TABLE `post_metrics` ADD COLUMN `avgWatchTimeMs` int NOT NULL DEFAULT 0;
  END IF;
END;
--> statement-breakpoint
CALL `__migr_0016_add_cols`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__migr_0016_add_cols`;
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

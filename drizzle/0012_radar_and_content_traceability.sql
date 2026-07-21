-- Module 1.1: Radar de Temas + traceability columns on content tables

-- New Radar tables
CREATE TABLE IF NOT EXISTS `trending_topics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `externalId` varchar(128) NOT NULL,
  `title` varchar(512) NOT NULL,
  `description` text,
  `source` varchar(16) NOT NULL DEFAULT 'serper',
  `viralScore` int NOT NULL DEFAULT 50,
  `emotionalAngle` varchar(16),
  `relevanceWindow` varchar(16),
  `niches` json,
  `collectedAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `trending_topics_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_trending_topics_externalId` UNIQUE(`externalId`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `user_topic_angles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `trendingTopicId` int NOT NULL,
  `suggestedTitle` varchar(512) NOT NULL,
  `suggestedHook` text NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'sugerido',
  `contentRef` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_topic_angles_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_user_topic_angles_user_topic` UNIQUE(`userId`, `trendingTopicId`)
);
--> statement-breakpoint
CREATE INDEX `idx_user_topic_angles_userId` ON `user_topic_angles` (`userId`);
--> statement-breakpoint

-- Traceability columns on carousels
ALTER TABLE `carousels`
  ADD COLUMN IF NOT EXISTS `sourceTopicAngleId` int,
  ADD COLUMN IF NOT EXISTS `hookType` varchar(32),
  ADD COLUMN IF NOT EXISTS `contentFormat` varchar(32) DEFAULT 'carousel';
--> statement-breakpoint

-- Traceability columns on articles
ALTER TABLE `articles`
  ADD COLUMN IF NOT EXISTS `sourceTopicAngleId` int,
  ADD COLUMN IF NOT EXISTS `hookType` varchar(32),
  ADD COLUMN IF NOT EXISTS `contentFormat` varchar(32) DEFAULT 'article';
--> statement-breakpoint

-- Traceability columns on reels_scripts (managed as raw SQL, documented here for audit)
-- ALTER TABLE `reels_scripts`
--   ADD COLUMN IF NOT EXISTS `sourceTopicAngleId` int,
--   ADD COLUMN IF NOT EXISTS `hookType` varchar(32),
--   ADD COLUMN IF NOT EXISTS `contentFormat` varchar(32) DEFAULT 'reels';
-- Note: reels_scripts is not in the Drizzle schema; migration is handled at runtime
--       in ensureReelsScriptsTable() via ALTER TABLE with duplicate-column guard.

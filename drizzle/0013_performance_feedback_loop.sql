-- Module 1.3: Feedback Loop de Performance

-- Columns on social_posts to track published media IDs
ALTER TABLE `social_posts`
  ADD COLUMN IF NOT EXISTS `igMediaId` varchar(100),
  ADD COLUMN IF NOT EXISTS `contentType` varchar(20),
  ADD COLUMN IF NOT EXISTS `contentId` int;
--> statement-breakpoint

-- templateId on carousels for template selector performance
ALTER TABLE `carousels`
  ADD COLUMN IF NOT EXISTS `templateId` int;
--> statement-breakpoint

-- Metric snapshots per published post (one row per collection run)
CREATE TABLE IF NOT EXISTS `post_metrics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `socialPostId` int NOT NULL,
  `collectedAt` timestamp NOT NULL DEFAULT (now()),
  `reach` int NOT NULL DEFAULT 0,
  `saves` int NOT NULL DEFAULT 0,
  `shares` int NOT NULL DEFAULT 0,
  `comments` int NOT NULL DEFAULT 0,
  `likes` int NOT NULL DEFAULT 0,
  `followsDelta` int NOT NULL DEFAULT 0,
  `rawScore` int NOT NULL DEFAULT 0,
  `normalizedScore` int NOT NULL DEFAULT 0,
  CONSTRAINT `post_metrics_id` PRIMARY KEY(`id`),
  INDEX `idx_post_metrics_socialPostId` (`socialPostId`)
);
--> statement-breakpoint

-- Aggregated performance by (user, niche, style, hookType, format, sourceKind)
CREATE TABLE IF NOT EXISTS `template_performance` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `niche` varchar(64) NOT NULL,
  `templateStyle` varchar(100) NOT NULL,
  `hookType` varchar(32) NOT NULL,
  `contentFormat` varchar(32) NOT NULL,
  `sourceKind` varchar(16) NOT NULL,
  `avgScore` int NOT NULL DEFAULT 0,
  `postCount` int NOT NULL DEFAULT 0,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `template_performance_id` PRIMARY KEY(`id`),
  INDEX `idx_template_perf_userId_niche` (`userId`, `niche`),
  CONSTRAINT `uq_template_perf_combo` UNIQUE (`userId`, `niche`, `templateStyle`, `hookType`, `contentFormat`, `sourceKind`)
);

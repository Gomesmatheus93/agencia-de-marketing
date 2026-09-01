CREATE TABLE IF NOT EXISTS `marketing_campaigns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `clientName` varchar(255),
  `objective` varchar(500),
  `audience` text,
  `offer` text,
  `description` text,
  `channels` json NOT NULL,
  `status` enum('draft','planning','production','approval','active','completed','archived') NOT NULL DEFAULT 'draft',
  `budgetCents` int NOT NULL DEFAULT 0,
  `spentCents` int NOT NULL DEFAULT 0,
  `revenueCents` int NOT NULL DEFAULT 0,
  `startDate` timestamp NULL,
  `endDate` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `marketing_campaigns_id` PRIMARY KEY (`id`),
  INDEX `idx_marketing_campaigns_user_status` (`userId`, `status`)
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `campaign_assets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `campaignId` int NOT NULL,
  `userId` int NOT NULL,
  `assetType` enum('article','carousel','post','image','reel','story','ad','report') NOT NULL,
  `assetId` int,
  `externalId` varchar(255),
  `label` varchar(500),
  `status` enum('draft','ready','pending_approval','approved','published','failed') NOT NULL DEFAULT 'draft',
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `campaign_assets_id` PRIMARY KEY (`id`),
  INDEX `idx_campaign_assets_campaign` (`campaignId`),
  INDEX `idx_campaign_assets_user` (`userId`)
);

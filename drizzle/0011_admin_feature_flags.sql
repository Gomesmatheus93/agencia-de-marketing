CREATE TABLE IF NOT EXISTS `feature_flags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `key` varchar(128) NOT NULL,
  `label` varchar(255) NOT NULL,
  `description` text,
  `enabled` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `feature_flags_id` PRIMARY KEY(`id`),
  CONSTRAINT `feature_flags_key_unique` UNIQUE(`key`)
);

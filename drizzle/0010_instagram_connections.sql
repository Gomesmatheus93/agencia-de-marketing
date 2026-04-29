CREATE TABLE IF NOT EXISTS `instagram_connections` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `instagramAccountId` varchar(64) NOT NULL,
  `facebookPageId` varchar(64),
  `username` varchar(64),
  `name` varchar(255),
  `profilePictureUrl` text,
  `accessToken` text NOT NULL,
  `tokenExpiresAt` timestamp,
  `connectedAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `instagram_connections_id` PRIMARY KEY(`id`),
  CONSTRAINT `instagram_connections_userId_unique` UNIQUE(`userId`)
);

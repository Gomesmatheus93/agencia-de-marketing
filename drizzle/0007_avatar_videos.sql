CREATE TABLE `avatar_videos` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `provider` varchar(32) NOT NULL DEFAULT 'd-id',
  `title` varchar(512) NOT NULL,
  `topic` text,
  `script` text NOT NULL,
  `sourceImageUrl` text NOT NULL,
  `videoUrl` text,
  `voiceProvider` varchar(64),
  `voiceId` varchar(128),
  `providerJobId` varchar(255),
  `status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
  `errorMessage` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `avatar_videos_id` PRIMARY KEY(`id`)
);

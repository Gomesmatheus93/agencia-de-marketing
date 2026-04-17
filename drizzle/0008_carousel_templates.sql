CREATE TABLE `carousel_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `imageUrl` text NOT NULL,
  `styleBrief` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `carousel_templates_id` PRIMARY KEY(`id`)
);

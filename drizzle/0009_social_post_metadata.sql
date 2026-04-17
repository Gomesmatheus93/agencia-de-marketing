SET @social_posts_metadata_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'social_posts'
    AND column_name = 'metadata'
);--> statement-breakpoint
SET @social_posts_metadata_sql = IF(
  @social_posts_metadata_exists = 0,
  'ALTER TABLE `social_posts` ADD COLUMN `metadata` text',
  'SELECT 1'
);--> statement-breakpoint
PREPARE social_posts_metadata_stmt FROM @social_posts_metadata_sql;--> statement-breakpoint
EXECUTE social_posts_metadata_stmt;--> statement-breakpoint
DEALLOCATE PREPARE social_posts_metadata_stmt;

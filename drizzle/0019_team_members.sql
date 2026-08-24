-- users.companyOwnerId: null = conta principal, preenchido = funcionário
-- (aponta pro id da conta principal). Permite várias contas de login
-- operarem sobre o mesmo conteúdo/marca de uma empresa.

DROP PROCEDURE IF EXISTS `__migr_0019_team_members`;
--> statement-breakpoint
CREATE PROCEDURE `__migr_0019_team_members`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'companyOwnerId'
  ) THEN
    ALTER TABLE `users` ADD COLUMN `companyOwnerId` int;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_companyOwnerId'
  ) THEN
    ALTER TABLE `users` ADD INDEX `idx_users_companyOwnerId` (`companyOwnerId`);
  END IF;
END;
--> statement-breakpoint
CALL `__migr_0019_team_members`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__migr_0019_team_members`;

-- Fases 2/4/5 do roadmap de segurança:
--   users.tokenVersion      — revogação de sessão (sair de todos os dispositivos)
--   users.emailVerifiedAt   — verificação de e-mail (contas antigas: backfill p/ NOW())
--   users.twoFactorEnabled  — 2FA por código de e-mail

DROP PROCEDURE IF EXISTS `__migr_0021_session_account`;
--> statement-breakpoint
CREATE PROCEDURE `__migr_0021_session_account`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tokenVersion'
  ) THEN
    ALTER TABLE `users` ADD COLUMN `tokenVersion` int NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emailVerifiedAt'
  ) THEN
    ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` timestamp NULL;
    -- Contas que já existem são consideradas verificadas (grandfather).
    UPDATE `users` SET `emailVerifiedAt` = NOW() WHERE `emailVerifiedAt` IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'twoFactorEnabled'
  ) THEN
    ALTER TABLE `users` ADD COLUMN `twoFactorEnabled` tinyint(1) NOT NULL DEFAULT 0;
  END IF;
END;
--> statement-breakpoint
CALL `__migr_0021_session_account`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__migr_0021_session_account`;

-- Fase 1 do roadmap de segurança: criptografia de campos sensíveis em repouso.
--
-- users.email / users.name passam a guardar ciphertext ("enc:v1:...").
--   - email vira TEXT (ciphertext não cabe em varchar(320))
--   - emailHash: blind index (HMAC-SHA256) para buscar por e-mail sem decifrar
--   - emailDomain: domínio em texto puro, usado pelo match de empresa
--     (server/_core/companyAccess.ts). O domínio já é público via company_domains.
-- O índice único de email é substituído por um índice único em emailHash.
--
-- O backfill dos valores existentes é feito por scripts/encrypt-existing-data.mjs.

DROP PROCEDURE IF EXISTS `__migr_0020_security_encryption`;
--> statement-breakpoint
CREATE PROCEDURE `__migr_0020_security_encryption`()
BEGIN
  -- email -> TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'email' AND DATA_TYPE <> 'text'
  ) THEN
    -- drop unique index on email first (if present)
    IF EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email' AND NON_UNIQUE = 0
    ) THEN
      SET @idx := (
        SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email' AND NON_UNIQUE = 0
        LIMIT 1
      );
      SET @sql := CONCAT('ALTER TABLE `users` DROP INDEX `', @idx, '`');
      PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
    ALTER TABLE `users` MODIFY COLUMN `email` text;
  END IF;

  -- name -> TEXT (já é text no schema atual, mas garante)
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'name' AND DATA_TYPE NOT IN ('text','mediumtext','longtext')
  ) THEN
    ALTER TABLE `users` MODIFY COLUMN `name` text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emailHash'
  ) THEN
    ALTER TABLE `users` ADD COLUMN `emailHash` varchar(64);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emailDomain'
  ) THEN
    ALTER TABLE `users` ADD COLUMN `emailDomain` varchar(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_emailHash'
  ) THEN
    ALTER TABLE `users` ADD UNIQUE INDEX `uq_users_emailHash` (`emailHash`);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_emailDomain'
  ) THEN
    ALTER TABLE `users` ADD INDEX `idx_users_emailDomain` (`emailDomain`);
  END IF;
END;
--> statement-breakpoint
CALL `__migr_0020_security_encryption`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__migr_0020_security_encryption`;

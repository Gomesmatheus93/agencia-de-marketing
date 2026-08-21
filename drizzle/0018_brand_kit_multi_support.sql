-- users.activeBrandKitId aponta pra qual Brand Kit preenche os módulos de
-- geração automaticamente; brand_kits.userId deixa de ser UNIQUE pra permitir
-- múltiplas marcas por conta (plano Agency). As duas mudanças já rodavam via
-- "runtime ensure" em server/db.ts, mas só disparavam quando algum endpoint
-- de Brand Kit era chamado — enquanto isso não acontecia num ambiente,
-- QUALQUER outra query em `users` (login, registro...) quebrava, porque o
-- Drizzle já inclui activeBrandKitId no SELECT com base no schema.ts.
-- Formalizando como migração pra rodar sempre no boot do container, antes de
-- servir tráfego.

DROP PROCEDURE IF EXISTS `__migr_0018_brand_kit_multi`;
--> statement-breakpoint
CREATE PROCEDURE `__migr_0018_brand_kit_multi`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'activeBrandKitId'
  ) THEN
    ALTER TABLE `users` ADD COLUMN `activeBrandKitId` int;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_kits'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_kits' AND INDEX_NAME = 'userId'
    ) THEN
      ALTER TABLE `brand_kits` DROP INDEX `userId`;
    END IF;

    UPDATE `users` u
    JOIN `brand_kits` bk ON bk.userId = u.id
    SET u.activeBrandKitId = bk.id
    WHERE u.activeBrandKitId IS NULL;
  END IF;
END;
--> statement-breakpoint
CALL `__migr_0018_brand_kit_multi`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `__migr_0018_brand_kit_multi`;

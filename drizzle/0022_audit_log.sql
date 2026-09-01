-- Fase 3 do roadmap de segurança: trilha de auditoria de ações sensíveis
-- (login, reset de senha, verificação de e-mail, 2FA, mudança de role/plano,
-- equipe, conexões OAuth).

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`           int AUTO_INCREMENT PRIMARY KEY,
  `actorUserId`  int,
  `targetUserId` int,
  `action`       varchar(64) NOT NULL,
  `targetType`   varchar(32),
  `targetId`     varchar(64),
  `ip`           varchar(64),
  `userAgent`    varchar(255),
  `metadata`     json,
  `createdAt`    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_log_actor` (`actorUserId`),
  INDEX `idx_audit_log_action` (`action`)
);

-- Fases 4/5: tokens de e-mail (verificação de conta, reset de senha, código 2FA).
-- Guarda só o SHA-256 do token; o valor cru só existe no link/código enviado.

CREATE TABLE IF NOT EXISTS `email_tokens` (
  `id`         int AUTO_INCREMENT PRIMARY KEY,
  `userId`     int NOT NULL,
  `type`       enum('verify','reset','2fa') NOT NULL,
  `tokenHash`  varchar(64) NOT NULL,
  `expiresAt`  timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `attempts`   int NOT NULL DEFAULT 0,
  `createdAt`  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_email_tokens_user_type` (`userId`, `type`),
  INDEX `idx_email_tokens_hash` (`tokenHash`)
);

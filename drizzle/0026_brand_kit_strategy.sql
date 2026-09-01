ALTER TABLE `brand_kits`
  ADD COLUMN `valueProposition` text,
  ADD COLUMN `productsServices` text,
  ADD COLUMN `differentiators` text,
  ADD COLUMN `brandPromise` text,
  ADD COLUMN `defaultCta` varchar(512),
  ADD COLUMN `headingFont` varchar(128) DEFAULT 'Montserrat',
  ADD COLUMN `bodyFont` varchar(128) DEFAULT 'Inter',
  ADD COLUMN `preferredWords` json,
  ADD COLUMN `forbiddenWords` json,
  ADD COLUMN `personas` json;

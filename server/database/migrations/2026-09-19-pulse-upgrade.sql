-- Additive MySQL upgrade bringing an existing tracker database up to Pulse.
-- Runs against the same database as the tracker. Safe to re-run: every step is
-- guarded on information_schema, and nothing is dropped or rewritten.
--
--   mysql -u USER -p DATABASE < server/database/migrations/2026-09-19-pulse-upgrade.sql
--
-- After this, the Mertis server's own initialize is a no-op for these objects.
-- email_config company_name/from_name are left alone so existing branding stands.

-- 1) Pit / Strike stamp
SET @db := DATABASE();

SET @has_triaged := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bugs' AND COLUMN_NAME = 'triaged_at'
);
SET @sql := IF(@has_triaged = 0,
  'ALTER TABLE `bugs` ADD COLUMN `triaged_at` timestamp NULL DEFAULT NULL AFTER `bugType`',
  'SELECT "bugs.triaged_at already present" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `bugs` SET `triaged_at` = `created_at` WHERE `triaged_at` IS NULL;

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bugs' AND INDEX_NAME = 'idx_triaged_at'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE `bugs` ADD KEY `idx_triaged_at` (`triaged_at`)',
  'SELECT "idx_triaged_at already present" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bugs' AND INDEX_NAME = 'idx_project_triaged'
);
SET @sql := IF(@has_idx = 0,
  'ALTER TABLE `bugs` ADD KEY `idx_project_triaged` (`project_key`, `triaged_at`)',
  'SELECT "idx_project_triaged already present" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Missions (one mission per bug)
CREATE TABLE IF NOT EXISTS `pulse_missions` (
  `id` varchar(36) NOT NULL,
  `project_id` varchar(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `intent` text NOT NULL,
  `owner` varchar(50) DEFAULT NULL,
  `target_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'hunting',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pulse_missions_project` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pulse_mission_bugs` (
  `mission_id` varchar(36) NOT NULL,
  `bug_id` varchar(20) NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `added_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`bug_id`),
  KEY `idx_pulse_mission_bugs_mission` (`mission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

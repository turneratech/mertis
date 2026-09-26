-- License system tables
-- Run this after the main mantis.sql schema is applied

USE mertis;

CREATE TABLE IF NOT EXISTS `licenses` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `license_key` TEXT NULL,
  `tier` ENUM('community','professional','enterprise','cloud') DEFAULT 'community',
  `status` ENUM('active','expired','suspended','trial') DEFAULT 'active',
  `customer_email` VARCHAR(255) NULL,
  `customer_name` VARCHAR(255) NULL,
  `company_name` VARCHAR(255) NULL,
  `max_users` INT NULL,
  `max_projects` INT NULL,
  `issued_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL,
  `last_validated_at` TIMESTAMP NULL,
  `last_online_check` TIMESTAMP NULL,
  `grace_period_ends` TIMESTAMP NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_tier` (`tier`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_id matches users.id which is varchar(36) UUID
CREATE TABLE IF NOT EXISTS `feature_usage_log` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `feature_name` VARCHAR(100) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `attempted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `allowed` BOOLEAN NOT NULL,
  `tier_required` VARCHAR(50) NULL,
  `current_tier` VARCHAR(50) NULL,
  INDEX `idx_feature_name` (`feature_name`),
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

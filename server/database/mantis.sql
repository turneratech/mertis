-- MySQL dump 10.13  Distrib 8.0.42, for Linux (x86_64)
--
-- Host: localhost    Database: mantis
-- ------------------------------------------------------
-- Server version	8.0.42-0ubuntu0.20.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `bug_activity`
--
USE mantis;
DROP TABLE IF EXISTS `bug_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bug_activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bug_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` enum('created','updated','comment','status_change','assigned','commit') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Temp1` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp2` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp3` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp4` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bug_id` (`bug_id`),
  KEY `idx_user` (`user`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_bug_created` (`bug_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=281 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bug_sequences`
--

DROP TABLE IF EXISTS `bug_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bug_sequences` (
  `project_key` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_number` int DEFAULT '0',
  `Temp1` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp2` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp3` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp4` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`project_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bugs`
--

DROP TABLE IF EXISTS `bugs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bugs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bug_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_key` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `client` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `environment` enum('Development','Staging','Production','Testing') COLLATE utf8mb4_unicode_ci DEFAULT 'Development',
  `severity` enum('Critical','High','Medium','Low') COLLATE utf8mb4_unicode_ci DEFAULT 'Medium',
  `priority` enum('Critical','High','Medium','Low') COLLATE utf8mb4_unicode_ci DEFAULT 'Medium',
  `status` enum('Open','In Progress','Resolved','Closed','Reopened') COLLATE utf8mb4_unicode_ci DEFAULT 'Open',
  `reporter` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignee` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qa_owner` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qa_status` enum('Not Started','Testing','Passed','Failed') COLLATE utf8mb4_unicode_ci DEFAULT 'Not Started',
  `target_fix_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_sla` date DEFAULT NULL,
  `attachment_links` text COLLATE utf8mb4_unicode_ci,
  `closure_reason` enum('Fixed','Won''t Fix','Duplicate','Cannot Reproduce','By Design','') COLLATE utf8mb4_unicode_ci DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `closed_at` timestamp NULL DEFAULT NULL,
  `arb` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bugType` enum('Bug','Enhancement','Task','Feature') COLLATE utf8mb4_unicode_ci DEFAULT 'Bug',
  `triaged_at` timestamp NULL DEFAULT NULL,
  `Temp3` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp4` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachments` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bug_id` (`bug_id`),
  KEY `idx_bug_id` (`bug_id`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_project_key` (`project_key`),
  KEY `idx_status` (`status`),
  KEY `idx_severity` (`severity`),
  KEY `idx_priority` (`priority`),
  KEY `idx_assignee` (`assignee`),
  KEY `idx_reporter` (`reporter`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_closed_at` (`closed_at`),
  KEY `idx_project_status` (`project_id`,`status`),
  KEY `idx_assignee_status` (`assignee`,`status`),
  KEY `idx_project_severity` (`project_id`,`severity`),
  KEY `idx_bug_type` (`bugType`),
  CONSTRAINT `bugs_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_config`
--

DROP TABLE IF EXISTS `email_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `config_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Default',
  `smtp_host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `smtp_port` int NOT NULL DEFAULT '587',
  `smtp_secure` tinyint(1) DEFAULT '0',
  `smtp_user` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `smtp_password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Mantis Reports',
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Mantis',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `email_config_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_log`
--

DROP TABLE IF EXISTS `email_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scheduled_report_id` int DEFAULT NULL,
  `recipients` text COLLATE utf8mb4_unicode_ci,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','sent','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `scheduled_report_id` (`scheduled_report_id`),
  KEY `idx_email_log_status` (`status`),
  KEY `idx_email_log_created` (`created_at`),
  CONSTRAINT `email_log_ibfk_1` FOREIGN KEY (`scheduled_report_id`) REFERENCES `scheduled_reports` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_members`
--

DROP TABLE IF EXISTS `project_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Temp1` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp2` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp3` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp4` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_project_member` (`project_id`,`username`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_username` (`username`),
  CONSTRAINT `project_members_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_key` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `client` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','archived','on-hold') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_by` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Temp1` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp2` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp3` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp4` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_key` (`project_key`),
  KEY `idx_project_key` (`project_key`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_recipients`
--

DROP TABLE IF EXISTS `report_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scheduled_report_id` int NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_recipient` (`scheduled_report_id`,`email`),
  CONSTRAINT `report_recipients_ibfk_1` FOREIGN KEY (`scheduled_report_id`) REFERENCES `scheduled_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scheduled_reports`
--

DROP TABLE IF EXISTS `scheduled_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_type` enum('weekly','monthly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'weekly',
  `frequency` enum('daily','weekly','biweekly','monthly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'weekly',
  `day_of_week` tinyint DEFAULT '1',
  `day_of_month` tinyint DEFAULT '1',
  `send_time` time DEFAULT '09:00:00',
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `projects` json DEFAULT NULL,
  `include_ai_insights` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `last_sent_at` timestamp NULL DEFAULT NULL,
  `next_scheduled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_scheduled_reports_active` (`is_active`),
  KEY `idx_scheduled_reports_next` (`next_scheduled_at`),
  CONSTRAINT `scheduled_reports_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','user','godmode') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Temp1` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp2` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp3` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Temp4` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `v_daily_bug_trend`
--

DROP TABLE IF EXISTS `v_daily_bug_trend`;
/*!50001 DROP VIEW IF EXISTS `v_daily_bug_trend`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_daily_bug_trend` AS SELECT 
 1 AS `date`,
 1 AS `created`,
 1 AS `closed`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_project_bug_stats`
--

DROP TABLE IF EXISTS `v_project_bug_stats`;
/*!50001 DROP VIEW IF EXISTS `v_project_bug_stats`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_project_bug_stats` AS SELECT 
 1 AS `project_id`,
 1 AS `project_name`,
 1 AS `project_key`,
 1 AS `total_bugs`,
 1 AS `open_bugs`,
 1 AS `in_progress_bugs`,
 1 AS `resolved_bugs`,
 1 AS `closed_bugs`,
 1 AS `critical_bugs`,
 1 AS `high_bugs`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_user_bug_stats`
--

DROP TABLE IF EXISTS `v_user_bug_stats`;
/*!50001 DROP VIEW IF EXISTS `v_user_bug_stats`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_user_bug_stats` AS SELECT 
 1 AS `user_id`,
 1 AS `username`,
 1 AS `role`,
 1 AS `assigned_bugs`,
 1 AS `open_assigned`,
 1 AS `resolved_bugs`,
 1 AS `reported_bugs`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `v_daily_bug_trend`
--

/*!50001 DROP VIEW IF EXISTS `v_daily_bug_trend`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`turneratech`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_daily_bug_trend` AS select cast(`b`.`created_at` as date) AS `date`,count(0) AS `created`,(select count(0) from `bugs` where (cast(`bugs`.`closed_at` as date) = cast(`b`.`created_at` as date))) AS `closed` from `bugs` `b` where (`b`.`created_at` >= (curdate() - interval 30 day)) group by cast(`b`.`created_at` as date) order by `date` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_project_bug_stats`
--

/*!50001 DROP VIEW IF EXISTS `v_project_bug_stats`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`turneratech`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_project_bug_stats` AS select `p`.`id` AS `project_id`,`p`.`name` AS `project_name`,`p`.`project_key` AS `project_key`,count(`b`.`id`) AS `total_bugs`,sum((case when (`b`.`status` = 'Open') then 1 else 0 end)) AS `open_bugs`,sum((case when (`b`.`status` = 'In Progress') then 1 else 0 end)) AS `in_progress_bugs`,sum((case when (`b`.`status` = 'Resolved') then 1 else 0 end)) AS `resolved_bugs`,sum((case when (`b`.`status` = 'Closed') then 1 else 0 end)) AS `closed_bugs`,sum((case when (`b`.`severity` = 'Critical') then 1 else 0 end)) AS `critical_bugs`,sum((case when (`b`.`severity` = 'High') then 1 else 0 end)) AS `high_bugs` from (`projects` `p` left join `bugs` `b` on((`p`.`id` = `b`.`project_id`))) group by `p`.`id`,`p`.`name`,`p`.`project_key` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_user_bug_stats`
--

/*!50001 DROP VIEW IF EXISTS `v_user_bug_stats`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`turneratech`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_user_bug_stats` AS select `u`.`id` AS `user_id`,`u`.`username` AS `username`,`u`.`role` AS `role`,count(distinct (case when (`b`.`assignee` = `u`.`username`) then `b`.`id` end)) AS `assigned_bugs`,count(distinct (case when ((`b`.`assignee` = `u`.`username`) and (`b`.`status` in ('Open','In Progress'))) then `b`.`id` end)) AS `open_assigned`,count(distinct (case when ((`b`.`assignee` = `u`.`username`) and (`b`.`status` in ('Resolved','Closed'))) then `b`.`id` end)) AS `resolved_bugs`,count(distinct (case when (`b`.`reporter` = `u`.`username`) then `b`.`id` end)) AS `reported_bugs` from (`users` `u` left join `bugs` `b` on(((`b`.`assignee` = `u`.`username`) or (`b`.`reporter` = `u`.`username`)))) group by `u`.`id`,`u`.`username`,`u`.`role` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-20  6:16:31

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

CREATE TABLE IF NOT EXISTS `pulse_calendar_sources` (
  `id` varchar(36) NOT NULL,
  `username` varchar(50) NOT NULL,
  `label` varchar(80) NOT NULL,
  `url` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pulse_calendar_sources_user` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

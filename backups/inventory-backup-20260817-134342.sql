-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: inventory
-- ------------------------------------------------------
-- Server version	8.0.45

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
-- Current Database: `inventory`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `inventory` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `inventory`;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(40) NOT NULL,
  `label` varchar(160) DEFAULT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(2000) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `updated_by` varchar(120) DEFAULT NULL,
  `value_type` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_7p82g7l6uve2vd8l30djhxpel` (`setting_key`),
  UNIQUE KEY `idx_app_settings_key` (`setting_key`),
  KEY `idx_app_settings_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES (1,'COMPANY','Company Name','company.name','SensoVibe Reliability Pvt. Ltd.','2026-07-31 07:22:25.517989','admin@inventory.com','string'),(2,'COMPANY','Contact Email','company.email','info@sensovibe.com','2026-07-31 07:20:49.035834',NULL,'string'),(3,'COMPANY','Contact Phone','company.phone','+91 00000 00000','2026-07-31 07:20:49.083144',NULL,'string'),(4,'COMPANY','Address','company.address','','2026-07-31 07:20:49.128439',NULL,'string'),(5,'COMPANY','GST / Tax Number','company.taxNumber','','2026-07-31 07:20:49.186082',NULL,'string'),(6,'COMPANY','Website','company.website','https://sensovibe.com','2026-07-31 07:20:49.252024',NULL,'string'),(7,'PREFERENCES','Date Format','preferences.dateFormat','DD MMM YYYY','2026-07-31 07:20:49.324559',NULL,'string'),(8,'PREFERENCES','Timezone','preferences.timezone','Asia/Kolkata','2026-07-31 07:20:49.391711',NULL,'string'),(9,'PREFERENCES','Rows Per Page','preferences.itemsPerPage','10','2026-07-31 07:22:25.408681','admin@inventory.com','number'),(10,'PREFERENCES','Language','preferences.language','English','2026-07-31 07:20:49.657216',NULL,'string'),(11,'INVENTORY','Currency','inventory.currency','INR','2026-07-31 07:20:49.736609',NULL,'string'),(12,'INVENTORY','Currency Symbol','inventory.currencySymbol','₹','2026-07-31 07:20:49.805181',NULL,'string'),(13,'INVENTORY','Default Low-Stock Threshold','inventory.defaultLowStockThreshold','10','2026-07-31 07:20:49.863356',NULL,'number'),(14,'INVENTORY','Auto-Generate Item Codes','inventory.autoGenerateItemCodes','true','2026-07-31 07:20:49.922321',NULL,'boolean'),(15,'INVENTORY','Allow Negative Stock','inventory.allowNegativeStock','false','2026-07-31 07:20:49.994367',NULL,'boolean'),(16,'NOTIFICATIONS','Low-Stock Alerts','notifications.lowStockAlerts','true','2026-07-31 07:20:50.144738',NULL,'boolean'),(17,'NOTIFICATIONS','Out-of-Stock Alerts','notifications.outOfStockAlerts','true','2026-07-31 07:20:50.219579',NULL,'boolean'),(18,'NOTIFICATIONS','New Item Alerts','notifications.newItemAlerts','true','2026-07-31 07:20:50.279681',NULL,'boolean'),(19,'NOTIFICATIONS','Purchase Alerts','notifications.purchaseAlerts','true','2026-07-31 07:20:50.362119',NULL,'boolean'),(20,'NOTIFICATIONS','Email Notifications','notifications.emailNotifications','false','2026-07-31 07:20:50.506201',NULL,'boolean'),(24,'BACKUP','Automatic Backup','backup.autoBackup','false','2026-07-31 07:20:50.762679',NULL,'boolean'),(25,'BACKUP','Backup Frequency','backup.frequency','weekly','2026-07-31 07:20:50.902485',NULL,'string'),(26,'BACKUP','Retention (days)','backup.retentionDays','30','2026-07-31 07:20:50.983194',NULL,'number');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action` varchar(100) NOT NULL,
  `description` text,
  `entity_id` bigint DEFAULT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `timestamp` datetime(6) NOT NULL,
  `user` varchar(120) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `book_issues`
--

DROP TABLE IF EXISTS `book_issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `book_issues` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `due_date` date NOT NULL,
  `issue_date` date NOT NULL,
  `issued_by` varchar(120) DEFAULT NULL,
  `remarks` varchar(500) DEFAULT NULL,
  `return_date` date DEFAULT NULL,
  `status` enum('ISSUED','OVERDUE','RETURNED') NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `book_id` bigint NOT NULL,
  `member_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_book_issues_status` (`status`),
  KEY `idx_book_issues_book` (`book_id`),
  KEY `idx_book_issues_member` (`member_id`),
  CONSTRAINT `FKc20hvaqq0n5rx6ngh148qw062` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `FKuciycsmklix0pfokjrpdaaka` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `book_issues`
--

LOCK TABLES `book_issues` WRITE;
/*!40000 ALTER TABLE `book_issues` DISABLE KEYS */;
/*!40000 ALTER TABLE `book_issues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `books`
--

DROP TABLE IF EXISTS `books`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `books` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `author` varchar(255) DEFAULT NULL,
  `available_copies` int NOT NULL,
  `book_code` varchar(20) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `edition` varchar(60) DEFAULT NULL,
  `isbn` varchar(40) DEFAULT NULL,
  `language` varchar(60) DEFAULT NULL,
  `notes` varchar(1000) DEFAULT NULL,
  `publisher` varchar(255) DEFAULT NULL,
  `shelf_location` varchar(60) DEFAULT NULL,
  `status` enum('ACTIVE','ARCHIVED','INACTIVE') NOT NULL,
  `title` varchar(255) NOT NULL,
  `total_copies` int NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_8osspp2iqw7t0nj1k35s7j98h` (`book_code`),
  UNIQUE KEY `idx_books_book_code` (`book_code`),
  KEY `idx_books_title` (`title`),
  KEY `idx_books_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `books`
--

LOCK TABLES `books` WRITE;
/*!40000 ALTER TABLE `books` DISABLE KEYS */;
/*!40000 ALTER TABLE `books` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `component_categories`
--

DROP TABLE IF EXISTS `component_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component_categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `description` varchar(300) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_m962d6b9lw6qk16y6qom5bn17` (`name`),
  UNIQUE KEY `idx_component_categories_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `component_categories`
--

LOCK TABLES `component_categories` WRITE;
/*!40000 ALTER TABLE `component_categories` DISABLE KEYS */;
INSERT INTO `component_categories` VALUES (1,'2026-08-16 15:37:05.000000',NULL,'Resistor','2026-08-16 15:37:05.000000'),(2,'2026-08-16 15:37:05.000000',NULL,'Capacitor','2026-08-16 15:37:05.000000'),(3,'2026-08-16 15:37:05.000000',NULL,'IC','2026-08-16 15:37:05.000000'),(4,'2026-08-16 15:37:05.000000',NULL,'Diode','2026-08-16 15:37:05.000000'),(5,'2026-08-16 15:37:05.000000',NULL,'Transistor','2026-08-16 15:37:05.000000'),(6,'2026-08-16 15:37:05.000000',NULL,'Inductor','2026-08-16 15:37:05.000000'),(7,'2026-08-16 15:37:05.000000',NULL,'Connector','2026-08-16 15:37:05.000000'),(8,'2026-08-16 15:37:05.000000',NULL,'Sensor','2026-08-16 15:37:05.000000'),(9,'2026-08-16 15:37:05.000000',NULL,'Microcontroller','2026-08-16 15:37:05.000000'),(10,'2026-08-16 15:37:05.000000',NULL,'Module','2026-08-16 15:37:05.000000'),(11,'2026-08-16 15:37:05.000000',NULL,'Other','2026-08-16 15:37:05.000000');
/*!40000 ALTER TABLE `component_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `component_usage`
--

DROP TABLE IF EXISTS `component_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component_usage` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `note` text,
  `quantity_used` int NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `used_date` date DEFAULT NULL,
  `component_id` bigint NOT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKk05ibihuvdyo3vd7wakv8t7v0` (`component_id`),
  KEY `FK5cjpm6m44xcpygso41fqvjphh` (`project_id`),
  CONSTRAINT `FK5cjpm6m44xcpygso41fqvjphh` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `FKk05ibihuvdyo3vd7wakv8t7v0` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `component_usage`
--

LOCK TABLES `component_usage` WRITE;
/*!40000 ALTER TABLE `component_usage` DISABLE KEYS */;
/*!40000 ALTER TABLE `component_usage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `components`
--

DROP TABLE IF EXISTS `components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `components` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(100) DEFAULT NULL,
  `component_name` varchar(150) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` text,
  `minimum_quantity` int NOT NULL,
  `quantity` int NOT NULL,
  `status` enum('ACTIVE','ARCHIVED','DISCONTINUED','INACTIVE') NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `item_code` varchar(20) DEFAULT NULL,
  `location` varchar(120) DEFAULT NULL,
  `unit_price` decimal(15,2) DEFAULT NULL,
  `category_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_j2cwrskugsuo2xepxxpfincqc` (`component_name`),
  UNIQUE KEY `UK_98o0qeh3r26vep2m034rn3tri` (`item_code`),
  KEY `fk_components_category` (`category_id`),
  CONSTRAINT `fk_components_category` FOREIGN KEY (`category_id`) REFERENCES `component_categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `components`
--

LOCK TABLES `components` WRITE;
/*!40000 ALTER TABLE `components` DISABLE KEYS */;
/*!40000 ALTER TABLE `components` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `equipment`
--

DROP TABLE IF EXISTS `equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `equipment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `location` varchar(120) DEFAULT NULL,
  `manufacturer` varchar(120) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `notes` text,
  `purchase_date` date DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `status` varchar(60) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `item_code` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_agm98wn5ln6uoh6o9hx25ogic` (`serial_number`),
  UNIQUE KEY `UK_ahqgon99i91kdlvnl3ja3v9w2` (`item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `equipment`
--

LOCK TABLES `equipment` WRITE;
/*!40000 ALTER TABLE `equipment` DISABLE KEYS */;
/*!40000 ALTER TABLE `equipment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `created_by` varchar(120) DEFAULT NULL,
  `quantity` int NOT NULL,
  `remarks` text,
  `transaction_date` date DEFAULT NULL,
  `transaction_type` enum('STOCK_IN','STOCK_OUT') NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `component_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKfw0wck0p3k881mgnlnsg0iq1l` (`component_id`),
  CONSTRAINT `FKfw0wck0p3k881mgnlnsg0iq1l` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transactions`
--

LOCK TABLES `inventory_transactions` WRITE;
/*!40000 ALTER TABLE `inventory_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_extractions`
--

DROP TABLE IF EXISTS `invoice_extractions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_extractions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content_type` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `created_by` varchar(120) DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `provider` varchar(50) DEFAULT NULL,
  `purchase_id` bigint DEFAULT NULL,
  `raw_json` longtext,
  `status` enum('CONFIRMED','DISCARDED','EXTRACTED','FAILED') NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_extractions`
--

LOCK TABLES `invoice_extractions` WRITE;
/*!40000 ALTER TABLE `invoice_extractions` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_extractions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `members`
--

DROP TABLE IF EXISTS `members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `members` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `department` varchar(120) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `employee_id` varchar(40) NOT NULL,
  `name` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_o7bxh85jwol23iokdggvexjdp` (`employee_id`),
  UNIQUE KEY `idx_members_employee_id` (`employee_id`),
  KEY `idx_members_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `members`
--

LOCK TABLES `members` WRITE;
/*!40000 ALTER TABLE `members` DISABLE KEYS */;
/*!40000 ALTER TABLE `members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `message` varchar(600) DEFAULT NULL,
  `is_read` bit(1) NOT NULL,
  `reference_id` bigint DEFAULT NULL,
  `reference_type` varchar(40) DEFAULT NULL,
  `severity` enum('CRITICAL','INFO','SUCCESS','WARNING') NOT NULL,
  `title` varchar(160) NOT NULL,
  `type` enum('COMPONENT_ADDED','EQUIPMENT_ADDED','INVENTORY_UPDATED','LOW_STOCK','OUT_OF_STOCK','PURCHASE_CREATED','SYSTEM') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_read` (`is_read`),
  KEY `idx_notifications_created` (`created_at`),
  KEY `idx_notifications_ref` (`type`,`reference_id`,`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_component_usage`
--

DROP TABLE IF EXISTS `project_component_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_component_usage` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `created_by` varchar(120) DEFAULT NULL,
  `quantity_used` int NOT NULL,
  `remarks` text,
  `updated_at` datetime(6) DEFAULT NULL,
  `usage_date` date DEFAULT NULL,
  `component_id` bigint NOT NULL,
  `project_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKrflyutysfayckc8ppdgjkenk6` (`component_id`),
  KEY `FK89vigydmolmx9i9ys2g5ulss8` (`project_id`),
  CONSTRAINT `FK89vigydmolmx9i9ys2g5ulss8` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `FKrflyutysfayckc8ppdgjkenk6` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_component_usage`
--

LOCK TABLES `project_component_usage` WRITE;
/*!40000 ALTER TABLE `project_component_usage` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_component_usage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `description` text,
  `end_date` date DEFAULT NULL,
  `project_name` varchar(150) NOT NULL,
  `start_date` date DEFAULT NULL,
  `status` enum('ACTIVE','COMPLETED','ON_HOLD') NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `project_manager` varchar(120) DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT NULL,
  `priority` enum('CRITICAL','HIGH','LOW','MEDIUM') DEFAULT NULL,
  `team_members` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_items`
--

DROP TABLE IF EXISTS `purchase_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `quantity` int NOT NULL,
  `total_price` decimal(38,2) NOT NULL,
  `unit_price` decimal(38,2) NOT NULL,
  `component_id` bigint NOT NULL,
  `purchase_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK92790exc5xy33n6r0xj867o2c` (`component_id`),
  KEY `FKhcski0jcuja0o3vhb7o15yqvi` (`purchase_id`),
  CONSTRAINT `FK92790exc5xy33n6r0xj867o2c` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`),
  CONSTRAINT `FKhcski0jcuja0o3vhb7o15yqvi` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_items`
--

LOCK TABLES `purchase_items` WRITE;
/*!40000 ALTER TABLE `purchase_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchases`
--

DROP TABLE IF EXISTS `purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchases` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `created_by` varchar(120) DEFAULT NULL,
  `invoice_file_original_name` varchar(255) DEFAULT NULL,
  `invoice_file_path` varchar(255) DEFAULT NULL,
  `invoice_file_stored_name` varchar(255) DEFAULT NULL,
  `invoice_number` varchar(120) NOT NULL,
  `invoice_processing_status` enum('FAILED','PROCESSED','PROCESSING','REVIEW_REQUIRED','UPLOADED') DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `remarks` varchar(1000) DEFAULT NULL,
  `supplier_name` varchar(150) DEFAULT NULL,
  `total_amount` decimal(38,2) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `supplier_id` bigint DEFAULT NULL,
  `invoice_uploaded_at` datetime(6) DEFAULT NULL,
  `invoice_uploaded_by` varchar(120) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_q5b14nxhx7fmvko48kq98adnv` (`invoice_number`),
  KEY `FK9ho3w23v5du4x0hrp6rqs1wmh` (`supplier_id`),
  CONSTRAINT `FK9ho3w23v5du4x0hrp6rqs1wmh` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchases`
--

LOCK TABLES `purchases` WRITE;
/*!40000 ALTER TABLE `purchases` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `address` text,
  `contact_person` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `notes` text,
  `phone` varchar(50) DEFAULT NULL,
  `status` varchar(30) DEFAULT NULL,
  `supplier_code` varchar(50) DEFAULT NULL,
  `supplier_name` varchar(150) NOT NULL,
  `tax_number` varchar(50) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_qlclyj0vn5vwtb86objyhmlkx` (`supplier_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `email` varchar(120) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(32) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `username` varchar(80) NOT NULL,
  `active` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_6dotkott2kjsp8vw4d0m25fb7` (`email`),
  UNIQUE KEY `UK_r43af9ap4edm43mmtq01oddj6` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'2026-08-08 00:38:45.000000','masteradmin@sensovibe.in','$2a$10$Sos9nRmPH4.DHUB1UO1/LeIAIDvvMcL0bjOmZ2vsyTKZuMchkYefi','MASTER_ADMIN','2026-08-08 04:26:01.526694','Laxman',_binary '');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'inventory'
--

--
-- Dumping routines for database 'inventory'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-17  8:13:43

-- =====================================================================
-- LostLink: Lost & Found Platform
-- File: database/schema.sql
-- Purpose: Creates the database, tables, relationships and indexes.
-- Target: MySQL 8.0+
--
-- WARNING: This script is RE-RUNNABLE, but each run DROPS the four
--          tables below and recreates them EMPTY. Do not run it
--          against a database that holds data you want to keep.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Create the database
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS lostlink_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lostlink_db;

-- ---------------------------------------------------------------------
-- 2. Drop existing tables (child tables first, because of foreign keys)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS status_history;
DROP TABLE IF EXISTS claims;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS categories;

-- ---------------------------------------------------------------------
-- 3. categories: lookup table used by the "Category" dropdown/filter
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id    INT          NOT NULL AUTO_INCREMENT,
  name  VARCHAR(50)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. items: every lost report AND every found report
--    'type' tells them apart, so one table/one form/one listing page
--    serves both.
-- ---------------------------------------------------------------------
CREATE TABLE items (
  id              INT           NOT NULL AUTO_INCREMENT,
  type            ENUM('lost','found')                        NOT NULL,
  title           VARCHAR(120)  NOT NULL,
  description     TEXT          NULL,
  category_id     INT           NOT NULL,
  location        VARCHAR(150)  NOT NULL,   -- where it was lost / found
  date_occurred   DATE          NOT NULL,   -- date it was lost / found
  image_path      VARCHAR(255)  NULL,       -- e.g. 'uploads/1712345678-ab12.jpg'
  status          ENUM('open','claimed','returned','closed')  NOT NULL DEFAULT 'open',
  reporter_name   VARCHAR(100)  NOT NULL,
  reporter_email  VARCHAR(120)  NOT NULL,
  reporter_phone  VARCHAR(20)   NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),

  -- Relationship: one category -> many items.
  -- RESTRICT prevents deleting a category that still has items.
  CONSTRAINT fk_items_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- Indexes that speed up browsing, filtering and the dashboard
  INDEX idx_items_type        (type),
  INDEX idx_items_status      (status),
  INDEX idx_items_category    (category_id),
  INDEX idx_items_created_at  (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. claims: ownership claims submitted against FOUND items
--    (The "found items only" rule is enforced in the backend code.)
-- ---------------------------------------------------------------------
CREATE TABLE claims (
  id                 INT           NOT NULL AUTO_INCREMENT,
  item_id            INT           NOT NULL,
  claimant_name      VARCHAR(100)  NOT NULL,
  claimant_email     VARCHAR(120)  NOT NULL,
  claimant_phone     VARCHAR(20)   NULL,
  proof_description  TEXT          NOT NULL,  -- details that prove ownership
  claim_status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),

  -- Relationship: one item -> many claims.
  -- CASCADE removes an item's claims if the item itself is deleted.
  CONSTRAINT fk_claims_item
    FOREIGN KEY (item_id) REFERENCES items (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_claims_item_id (item_id),
  INDEX idx_claims_status  (claim_status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. status_history: audit trail of every recovery-status change
-- ---------------------------------------------------------------------
CREATE TABLE status_history (
  id          INT           NOT NULL AUTO_INCREMENT,
  item_id     INT           NOT NULL,
  old_status  VARCHAR(20)   NOT NULL,
  new_status  VARCHAR(20)   NOT NULL,
  note        VARCHAR(255)  NULL,             -- optional admin comment
  changed_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),

  -- Relationship: one item -> many history entries.
  CONSTRAINT fk_history_item
    FOREIGN KEY (item_id) REFERENCES items (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_history_item_id (item_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. (OPTIONAL) Dedicated application user: least-privilege access
--
--    The backend should NOT connect as 'root'. To create a limited user:
--      a) Remove the leading "-- " from the lines below
--      b) Replace CHANGE_ME_STRONG_PASSWORD with your own password
--      c) Select those lines and run them
--    Then put the same username/password in server/.env later.
-- ---------------------------------------------------------------------
-- CREATE USER IF NOT EXISTS 'lostlink_user'@'localhost'
--   IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON lostlink_db.* TO 'lostlink_user'@'localhost';
-- FLUSH PRIVILEGES;
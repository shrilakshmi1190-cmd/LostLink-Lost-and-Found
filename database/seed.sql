-- =====================================================================
-- LostLink: Lost & Found Platform
-- File: database/seed.sql
-- Purpose: Fills the database with categories and sample data.
-- Run AFTER schema.sql.
--
-- Notes:
--   * Safe to re-run: it empties the four tables first, then reinserts.
--   * All people, emails and phone numbers are FICTIONAL (example.com).
--   * Dates are relative to today (CURDATE()/NOW()), so the data always
--     looks recent on the dashboard.
--   * image_path is NULL for all samples; the frontend will show a
--     placeholder image. Real uploads fill it in later.
-- =====================================================================

USE lostlink_db;

-- ---------------------------------------------------------------------
-- Empty the tables (foreign key checks are paused only for this step)
-- ---------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE status_history;
TRUNCATE TABLE claims;
TRUNCATE TABLE items;
TRUNCATE TABLE categories;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. Categories (required by the app; keep these even if you skip
--    the sample items below)
-- ---------------------------------------------------------------------
INSERT INTO categories (id, name) VALUES
  (1, 'Electronics'),
  (2, 'Wallets'),
  (3, 'Keys'),
  (4, 'Bags'),
  (5, 'Documents'),
  (6, 'Clothing'),
  (7, 'Other');

-- ---------------------------------------------------------------------
-- 2. Sample items (12 total: 5 lost, 7 found)
--    Status mix: 8 open, 2 claimed, 1 returned, 1 closed
-- ---------------------------------------------------------------------
INSERT INTO items
  (id, type, title, description, category_id, location, date_occurred, image_path,
   status, reporter_name, reporter_email, reporter_phone, created_at)
VALUES
  (1, 'lost', 'Black leather wallet',
   'Black bifold wallet with a small scratch on the front. Contains student ID and some cash. Lost while walking from the library to the canteen.',
   2, 'Central Library entrance', CURDATE() - INTERVAL 3 DAY, NULL,
   'open', 'Aarav Sharma', 'aarav.sharma@example.com', '9876500001', NOW() - INTERVAL 3 DAY),

  (2, 'found', 'Samsung smartphone with blue case',
   'Found on a bench near the cafeteria. Phone is locked, has a blue protective case and a cracked corner on the screen.',
   1, 'Main cafeteria', CURDATE() - INTERVAL 2 DAY, NULL,
   'open', 'Priya Nair', 'priya.nair@example.com', '9876500002', NOW() - INTERVAL 2 DAY),

  (3, 'found', 'Set of keys with red keychain',
   'Three keys on a red ring with a small football charm. Found on the floor of Lab Block B.',
   3, 'Lab Block B, ground floor', CURDATE() - INTERVAL 10 DAY, NULL,
   'claimed', 'Rohan Mehta', 'rohan.mehta@example.com', '9876500003', NOW() - INTERVAL 10 DAY),

  (4, 'lost', 'Navy blue backpack',
   'Navy blue backpack with a white logo. Contains notebooks and a scientific calculator. Left behind after the afternoon lecture.',
   4, 'Lecture Hall 204', CURDATE() - INTERVAL 5 DAY, NULL,
   'open', 'Sneha Reddy', 'sneha.reddy@example.com', '9876500004', NOW() - INTERVAL 5 DAY),

  (5, 'found', 'Student ID card',
   'College ID card found near the bus stop. Name on the card is partially hidden to prevent misuse; owner should describe the photo and department.',
   5, 'College bus stop', CURDATE() - INTERVAL 14 DAY, NULL,
   'returned', 'Karthik Iyer', 'karthik.iyer@example.com', '9876500005', NOW() - INTERVAL 14 DAY),

  (6, 'lost', 'Silver wristwatch',
   'Silver analog wristwatch with a metal strap and a small engraving on the back. Possibly lost in the sports complex changing room.',
   7, 'Sports complex', CURDATE() - INTERVAL 7 DAY, NULL,
   'open', 'Meera Joshi', 'meera.joshi@example.com', NULL, NOW() - INTERVAL 7 DAY),

  (7, 'found', 'Grey hoodie',
   'Grey zip-up hoodie, size M, left on a chair in the seminar room.',
   6, 'Seminar Hall', CURDATE() - INTERVAL 4 DAY, NULL,
   'open', 'Imran Khan', 'imran.khan@example.com', '9876500007', NOW() - INTERVAL 4 DAY),

  (8, 'lost', 'Laptop charger',
   'Black 65W laptop charger with a white cable tie around the wire.',
   1, 'Computer Lab 2', CURDATE() - INTERVAL 20 DAY, NULL,
   'closed', 'Divya Menon', 'divya.menon@example.com', '9876500008', NOW() - INTERVAL 20 DAY),

  (9, 'found', 'Wireless earbuds case',
   'White earbuds charging case, no earbuds inside. Found under a table in the library reading area.',
   1, 'Central Library, reading area', CURDATE() - INTERVAL 1 DAY, NULL,
   'open', 'Ananya Das', 'ananya.das@example.com', '9876500009', NOW() - INTERVAL 1 DAY),

  (10, 'found', 'Black umbrella',
   'Large black umbrella with a wooden handle. Left near the main gate security desk.',
   7, 'Main gate', CURDATE() - INTERVAL 6 DAY, NULL,
   'open', 'Vikram Singh', 'vikram.singh@example.com', NULL, NOW() - INTERVAL 6 DAY),

  (11, 'lost', 'Car key with remote',
   'Black car key with a remote lock button and a blue tag reading "Parking B". Lost around the parking area.',
   3, 'Parking Lot B', CURDATE() - INTERVAL 2 DAY, NULL,
   'open', 'Rahul Verma', 'rahul.verma@example.com', '9876500011', NOW() - INTERVAL 2 DAY),

  (12, 'found', 'Brown leather wallet',
   'Brown leather wallet found beside the vending machines. Contains cards; contents will be verified with the owner in person.',
   2, 'Admin block corridor', CURDATE() - INTERVAL 1 DAY, NULL,
   'open', 'Lakshmi Pillai', 'lakshmi.pillai@example.com', '9876500012', NOW() - INTERVAL 1 DAY);

-- ---------------------------------------------------------------------
-- 3. Sample claims (found items only: items 2, 3, 5, 12)
-- ---------------------------------------------------------------------
INSERT INTO claims
  (id, item_id, claimant_name, claimant_email, claimant_phone,
   proof_description, claim_status, created_at)
VALUES
  (1, 2, 'Nikhil Rao', 'nikhil.rao@example.com', '9876500101',
   'The phone is mine. The lock screen shows a photo of a golden retriever, and the case has a sticker of a mountain on the inside.',
   'pending', NOW() - INTERVAL 1 DAY),

  (2, 2, 'Sara Thomas', 'sara.thomas@example.com', NULL,
   'I think this is my phone. It is a Samsung with a blue case.',
   'pending', NOW() - INTERVAL 12 HOUR),

  (3, 3, 'Arjun Kapoor', 'arjun.kapoor@example.com', '9876500103',
   'These are my hostel room, bike and locker keys. The football charm was a gift from my brother.',
   'approved', NOW() - INTERVAL 9 DAY),

  (4, 3, 'Pooja Bhat', 'pooja.bhat@example.com', NULL,
   'I lost a set of keys somewhere in the lab block.',
   'rejected', NOW() - INTERVAL 9 DAY),

  (5, 5, 'Siddharth Jain', 'siddharth.jain@example.com', '9876500105',
   'It is my ID card. I study Mechanical Engineering, and my photo has me wearing glasses.',
   'approved', NOW() - INTERVAL 13 DAY),

  (6, 12, 'Farah Ali', 'farah.ali@example.com', '9876500106',
   'The wallet has my library card and a metro card. There is also a folded photo of my grandmother in the coin pocket.',
   'pending', NOW() - INTERVAL 6 HOUR);

-- ---------------------------------------------------------------------
-- 4. Sample status history (matches the statuses set above)
--    Item 3 -> claimed | Item 5 -> claimed then returned | Item 8 -> closed
-- ---------------------------------------------------------------------
INSERT INTO status_history
  (id, item_id, old_status, new_status, note, changed_at)
VALUES
  (1, 3, 'open',    'claimed',  'Claim approved after the owner described the keychain charm.', NOW() - INTERVAL 8 DAY),
  (2, 5, 'open',    'claimed',  'Claim approved; owner described the ID photo correctly.',       NOW() - INTERVAL 12 DAY),
  (3, 5, 'claimed', 'returned', 'Owner collected the ID card from the admin office.',            NOW() - INTERVAL 11 DAY),
  (4, 8, 'open',    'closed',   'Owner reported finding the charger; listing closed.',           NOW() - INTERVAL 15 DAY);

-- ---------------------------------------------------------------------
-- Done. Quick sanity check (expected: 7, 12, 6, 4)
-- ---------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM categories)     AS categories,
  (SELECT COUNT(*) FROM items)          AS items,
  (SELECT COUNT(*) FROM claims)         AS claims,
  (SELECT COUNT(*) FROM status_history) AS status_history;
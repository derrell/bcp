CREATE TABLE User
(
  username          VARCHAR PRIMARY KEY NOT NULL,
  password          VARCHAR,
  permission_level  INTEGER DEFAULT 0
);

CREATE TABLE Client
(
  family_name               VARCHAR PRIMARY KEY NOT NULL,
  phone                     VARCHAR,
  email                     VARCHAR,
  email_confirmed           BOOLEAN DEFAULT FALSE,
  ethnicity                 VARCHAR,
  language_abbreviation     VARCHAR DEFAULT 'en',
  count_elderly             INTEGER DEFAULT 0,  -- number of family members 80+
  count_senior              INTEGER DEFAULT 0,  -- number of family members 65+
  count_adult               INTEGER DEFAULT 0,  -- number of family members 18-64
  count_young_adult         INTEGER DEFAULT 0,  --  number of family members 18-25
  count_child               INTEGER DEFAULT 0,  -- number of family members 0-17
  count_sex_male            INTEGER DEFAULT 0,
  count_sex_female          INTEGER DEFAULT 0,
  count_sex_other           INTEGER DEFAULT 0,
  count_veteran             INTEGER DEFAULT 0,
  income_source             VARCHAR,
  income_amount             REAL,
  usda_eligible             VARCHAR NOT NULL DEFAULT '',
  usda_eligible_next_distro VARCHAR DEFAULT NULL,
  usda_prior_signature      VARCHAR DEFAULT NULL,
  usda_prior_signature_statement VARCHAR DEFAULT NULL,
  usda_prior_signature_hash VARCHAR DEFAULT NULL,
  usda_prior_signature_date VARCHAR DEFAULT NULL,
  usda_prior_family_size    INTEGER DEFAULT 0,    -- family size at time of signature
  usda_prior_max_income     INTEGER DEFAULT 0,    -- usda max income for that family size
  usda_require_new_signature BOOLEAN DEFAULT FALSE,
  pet_types                 VARCHAR,
  address_default           VARCHAR, -- default address for delivery
  appt_day_default          INTEGER, -- 1-relative to distro start
  appt_time_default         VARCHAR, -- default appt time HH:MM,
  verified                  BOOLEAN DEFAULT FALSE,
  archived                  BOOLEAN DEFAULT FALSE,
  notes_default             VARCHAR NOT NULL DEFAULT '',
  perishables_default       VARCHAR NOT NULL DEFAULT '',
  UNIQUE (family_name COLLATE NOCASE)
);

-- Changes from original to derive the above table
--
-- ALTER TABLE Client ADD COLUMN notes_default VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE Client ADD COLUMN perishables_default VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE Client ADD COLUMN usda_eligible VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE Client ADD COLUMN usda_eligible_next_distro VARCHAR DEFAULT NULL;
-- ALTER TABLE Client ADD COLUMN language_abbreviation VARCHAR DEFAULT 'en';
-- ALTER TABLE Client ADD COLUMN count_young_adult INTEGER DEFAULT 0;
-- ALTER TABLE Client ADD COLUMN count_elderly INTEGER DEFAULT 0;
-- ALTER TABLE Client ADD COLUMN email_confirmed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE Client ADD COLUMN usda_prior_signature VARCHAR DEFAULT NULL;
-- ALTER TABLE Client ADD COLUMN usda_prior_signature_statement VARCHAR DEFAULT NULL;
-- ALTER TABLE Client ADD COLUMN usda_prior_signature_hash VARCHAR DEFAULT NULL;
-- ALTER TABLE Client ADD COLUMN usda_prior_signature_date VARCHAR DEFAULT NULL;
-- ALTER TABLE Client ADD COLUMN usda_prior_family_size INTEGER DEFAULT 0;
-- ALTER TABLE Client ADD COLUMN usda_prior_max_income INTEGER DEFAULT 0;
-- ALTER TABLE Client ADD COLUMN usda_require_new_signature BOOLEAN DEFAULT FALSE;


--
-- Fulfillment records aren't created until needed, so we can't
-- maintain USDA eligibility there, since it is copied from
-- next-distribution eligibility of the prior distribution, when a new
-- distribution is created. Instead, maintain a permanent copy of the
-- next-distribution eligibility, per distribution, in a separate
-- table so that the USDA report can be generated for any distribution.
-- Similarly, for next-distribution eligibility.
--
-- First, for a new client...
CREATE TRIGGER tr_ai_Client
AFTER INSERT ON Client
BEGIN
  REPLACE INTO UsdaEligibleHistory (
      distribution,
      family_name,
      usda_eligible
    ) VALUES (
      (SELECT MAX(start_date) FROM DistributionPeriod),
      new.family_name,
      new.usda_eligible
    );

  REPLACE INTO UsdaEligibleNextDistroHistory (
      distribution,
      family_name,
      usda_eligible_next_distro
    ) VALUES (
      (SELECT MAX(start_date) FROM DistributionPeriod),
      new.family_name,
      new.usda_eligible_next_distro
    );

  -- No need to maintain null entries here
  DELETE FROM UsdaEligibleNextDistroHistory
    WHERE
      family_name = new.family_name
      AND distribution = (SELECT MAX(start_date) FROM DistributionPeriod)
      AND usda_eligible_next_distro IS NULL;
END;

-- ... and then for an update of an existing client
CREATE TRIGGER tr_au_Client
AFTER UPDATE ON Client
BEGIN
  REPLACE INTO UsdaEligibleHistory (
      distribution,
      family_name,
      usda_eligible
    ) VALUES (
      (SELECT MAX(start_date) FROM DistributionPeriod),
      new.family_name,
      new.usda_eligible
    );

  REPLACE INTO UsdaEligibleNextDistroHistory (
      distribution,
      family_name,
      usda_eligible_next_distro
    ) VALUES (
      (SELECT MAX(start_date) FROM DistributionPeriod),
      new.family_name,
      new.usda_eligible_next_distro
    );

  DELETE FROM UsdaEligibleNextDistroHistory
    WHERE
      family_name = new.family_name
      AND distribution = (SELECT MAX(start_date) FROM DistributionPeriod)
      AND usda_eligible_next_distro IS NULL;
END;

CREATE TABLE ClientId
(
  family_name       VARCHAR REFERENCES Client
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  id                INTEGER,    -- Don't manually manipulate; edited by trigger
  PRIMARY KEY (family_name)
);

CREATE TRIGGER tr_ai_ClientId
AFTER INSERT ON ClientId
BEGIN
  UPDATE ClientId
    SET id = new.rowid
    WHERE family_name = new.family_name;
END;


CREATE TABLE FamilyMember
(
  family_name     VARCHAR REFERENCES Client
                          ON DELETE CASCADE
                          ON UPDATE CASCADE,
  member_name     VARCHAR NOT NULL,
  date_of_birth   VARCHAR NOT NULL, -- in format YYYY-MM-DD
  gender          VARCHAR NOT NULL, -- M, F, O
  is_veteran      BOOLEAN NOT NULL, -- 0=false, 1=true,

  -- transient:
  -- updated as needed by StoredProc_UpdateAge, with an as-of date
  age             INTEGER,

  PRIMARY KEY (family_name, member_name)
);


CREATE TABLE Fulfillment
(
  distribution      VARCHAR REFERENCES DistributionPeriod
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  family_name       VARCHAR REFERENCES Client
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  appt_day          INTEGER,    -- 1-relative to distribution
  appt_time         VARCHAR,    -- %H:%M; null if fullfilled w/out appointment
  fulfilled         BOOLEAN DEFAULT FALSE,  -- has been picked up or delivered
  fulfillment_time  VARCHAR,                -- %Y-%m-%d %H:%M:%S
  notes             VARCHAR,
  perishables       VARCHAR,
  usda_eligible_signature  VARCHAR DEFAULT NULL,
  usda_signature_statement VARCHAR DEFAULT NULL,
  usda_signature_hash      VARCHAR DEFAULT NULL,
  usda_signature_date      VARCHAR DEFAULT NULL,
  usda_family_size  INTEGER DEFAULT 0,    -- family size at time of signature
  usda_max_income   INTEGER DEFAULT 0,    -- usda max income for that family size
  arrival_time      VARCHAR DEFAULT NULL,   -- %Y-%m-%d %H:%M:%S
  arrival_order     INTEGER,
  memo              VARCHAR DEFAULT '',
  PRIMARY KEY (distribution, family_name)
);

-- ALTER TABLE Fulfillment ADD COLUMN perishables VARCHAR;
-- ALTER TABLE Fulfillment ADD COLUMN usda_eligible_signature VARCHAR DEFAULT NULL;
-- ALTER TABLE Fulfillment ADD COLUMN usda_signature_statement VARCHAR DEFAULT NULL;
-- ALTER TABLE Fulfillment ADD COLUMN usda_signature_hash VARCHAR DEFAULT NULL;
-- ALTER TABLE Fulfillment DROP COLUMN is_usda_current;
-- ALTER TABLE Fulfillment ADD COLUMN arrival_time VARCHAR DEFAULT NULL;
-- ALTER TABLE Fulfillment ADD COLUMN memo VARCHAR DEFAULT '';
-- ALTER TABLE Fulfillment ADD COLUMN arrival_order INTEGER;
-- ALTER TABLE Fulfillment ADD COLUMN usda_signature_date VARCHAR DEFAULT NULL;
-- ALTER TABLE Fulfillment ADD COLUMN usda_family_size INTEGER DEFAULT 0;
-- ALTER TABLE Fulfillment ADD COLUMN usda_max_income INTEGER DEFAULT 0;


CREATE INDEX Fulfillment_appt_idx
  ON Fulfillment(distribution, appt_day, appt_time);

-- We need to add a ClientId record if it doesn't exist... and leave
-- an existing one entirely unaltered.
-- INSERT OR IGNORE seems to actually delete the row and recreate it,
-- changing the row id. Instead, we'll see if it exists and leave the
-- trigger early if so. If we don't leave the trigger, we know we can
-- insert a new record because the family name was not previously found.
CREATE TRIGGER tr_ai_Fulfillment
AFTER INSERT ON Fulfillment
BEGIN
  SELECT CASE
    WHEN
      (SELECT COUNT(*)
        FROM ClientId
        WHERE family_name = new.family_name) > 0 THEN
      RAISE (IGNORE)
  END;
  INSERT INTO ClientId (family_name) VALUES (new.family_name);
END;

-- To prepopulate ClientId with existing family names:
-- INSERT INTO ClientId (family_name) SELECT DISTINCT(family_name) FROM Fulfillment;



CREATE TABLE DistributionPeriod
(
  start_date        VARCHAR PRIMARY KEY,    -- %Y-%m-%d

  -- This might later change to a separate table of appointment
  -- start/end per day, if we need more seven days per distribution
  day_1_date        VARCHAR DEFAULT '', --%&-%m-%d
  day_1_first_appt  VARCHAR,            -- %H:%M
  day_1_last_appt   VARCHAR,
  day_2_date        VARCHAR DEFAULT '',
  day_2_first_appt  VARCHAR,
  day_2_last_appt   VARCHAR,
  day_3_date        VARCHAR DEFAULT '',
  day_3_first_appt  VARCHAR,
  day_3_last_appt   VARCHAR,
  day_4_date        VARCHAR DEFAULT '',
  day_4_first_appt  VARCHAR,
  day_4_last_appt   VARCHAR,
  day_5_date        VARCHAR DEFAULT '',
  day_5_first_appt  VARCHAR,
  day_5_last_appt   VARCHAR,
  day_6_date        VARCHAR DEFAULT '',
  day_6_first_appt  VARCHAR,
  day_6_last_appt   VARCHAR,
  day_7_date        VARCHAR DEFAULT '',
  day_7_first_appt  VARCHAR,
  day_7_last_appt   VARCHAR
);

-- ALTER TABLE DistributionPeriod ADD COLUMN day_1_date VARCHAR DEFAULT '';
-- ALTER TABLE DistributionPeriod ADD COLUMN day_2_date VARCHAR DEFAULT '';
-- ALTER TABLE DistributionPeriod ADD COLUMN day_3_date VARCHAR DEFAULT '';
-- ALTER TABLE DistributionPeriod ADD COLUMN day_4_date VARCHAR DEFAULT '';
-- ALTER TABLE DistributionPeriod ADD COLUMN day_5_date VARCHAR DEFAULT '';
-- ALTER TABLE DistributionPeriod ADD COLUMN day_6_date VARCHAR DEFAULT '';
-- ALTER TABLE DistributionPeriod ADD COLUMN day_7_date VARCHAR DEFAULT '';

CREATE TABLE Report
(
  name              VARCHAR PRIMARY KEY NOT NULL,
  description       VARCHAR NOT NULL,
  pre_query         VARCHAR,
  query             VARCHAR NOT NULL,
  input_fields      VARCHAR,
  subtitle_field    VARCHAR,
  separate_by       VARCHAR,
  landscape         BOOLEAN DEFAULT 0,
  format_key_value  BOOLEAN DEFAULT 0,
  number_style      VARCHAR,
  number_remaining  VARCHAR,
  UNIQUE (name COLLATE NOCASE)
);

-- ALTER TABLE Report ADD COLUMN pre_query VARCHAR;
-- ALTER TABLE Report ADD COLUMN format_key_value BOOLEAN DEFAULT 0;

CREATE TABLE UsdaMaxIncome
(
  family_size       INTEGER PRIMARY KEY,
  max_income_num    INTEGER NOT NULL,
  max_income_text   VARCHAR NOT NULL
);

REPLACE INTO UsdaMaxIncome VALUES (1, 3138, '$3,138');
REPLACE INTO UsdaMaxIncome VALUES (2, 4258, '$4,258');
REPLACE INTO UsdaMaxIncome VALUES (3, 5379, '$5,379');
REPLACE INTO UsdaMaxIncome VALUES (4, 6500, '$6,500');
REPLACE INTO UsdaMaxIncome VALUES (5, 7621, '$7,621');
REPLACE INTO UsdaMaxIncome VALUES (6, 8742, '$8,742');
REPLACE INTO UsdaMaxIncome VALUES (7, 9863, '$9,863');
REPLACE INTO UsdaMaxIncome VALUES (8, 10983, '$10,983');
REPLACE INTO UsdaMaxIncome VALUES (9, 12104, '$12,104');
REPLACE INTO UsdaMaxIncome VALUES (10, 13225, '$13,225');
REPLACE INTO UsdaMaxIncome VALUES (11, 14346, '$14,346');
REPLACE INTO UsdaMaxIncome VALUES (12, 15467, '$15,467');
REPLACE INTO UsdaMaxIncome VALUES (13, 16588, '$16,588');
REPLACE INTO UsdaMaxIncome VALUES (14, 17709, '$17,709');


CREATE TABLE UsdaEligibleHistory
(
  distribution              VARCHAR REFERENCES DistributionPeriod
                                ON DELETE CASCADE
                                ON UPDATE CASCADE,
  family_name               VARCHAR REFERENCES Client
                                ON DELETE CASCADE
                                ON UPDATE CASCADE,
  usda_eligible             VARCHAR NOT NULL DEFAULT '',
  PRIMARY KEY (distribution, family_name)
);


CREATE TABLE UsdaEligibleNextDistroHistory
(
  distribution              VARCHAR REFERENCES DistributionPeriod
                                ON DELETE CASCADE
                                ON UPDATE CASCADE,
  family_name               VARCHAR REFERENCES Client
                                ON DELETE CASCADE
                                ON UPDATE CASCADE,
  usda_eligible_next_distro BOOLEAN DEFAULT NULL,
  PRIMARY KEY (distribution, family_name)
);

-- ALTER TABLE UsdaEligibleNextDistro RENAME TO UsdaEligibleNextDistroHistory;

-- Misc data storage:
--   motd
--   greeterPin
--
-- These are reset to 0 when a new distribution is created, and
-- incremented when a client arrives, to be used as the arrival order
-- for that client:
--   arrivalOrderDay1
--   arrivalOrderDay2
--   arrivalOrderDay3
--   arrivalOrderDay4
--   arrivalOrderDay5
--   arrivalOrderDay6
--   arrivalOrderDay7
CREATE TABLE KeyValueStore
(
  key               VARCHAR PRIMARY KEY NOT NULL,
  value             VARCHAR
);

-- REPLACE INTO KeyValueStore (key, value) VALUES ('greeterPin', "111222");

--
-- "Stored Procedures"
--

-- Update a family member's age as of a given date
-- The AFTER INSERT trigger modifies table FamilyMember
CREATE TABLE StoredProc_UpdateAge
(
  id              INTEGER PRIMARY KEY,

  -- parameters
  birthday        TEXT,
  asOf            TEXT,
  family_name     TEXT,
  member_name     TEXT,

  -- "local variables"
  age             INTEGER,
  mDiff           INTEGER
);

CREATE TRIGGER tr_ai_StoredProc_UpdateAge
AFTER INSERT ON StoredProc_UpdateAge
BEGIN
  -- age = asOf.year - birthday.year
  UPDATE StoredProc_UpdateAge
    SET age =
      (SELECT strftime('%Y', new.asOf)) -
      (SELECT strftime('%Y', new.birthday))
    WHERE id = new.rowid;

  -- mDiff = asOf.month - birthday.month
  -- (see if birthday month has passed yet)
  UPDATE StoredProc_UpdateAge
    SET mDiff =
      (SELECT strftime('%m', new.asOf)) -
      (SELECT strftime('%m', new.birthday))
    WHERE id = new.rowid;

  -- if (mDiff < 0 || (mDiff === 0 && asOf.day < birthday.day)) --age;
  -- "asOf.day" is taken to be the last day of the asOf month, so
  -- that a baby born during the month is considered an existing child
  -- during any day of the distribution.
  UPDATE StoredProc_UpdateAge
    SET age = age - 1
    WHERE id == new.rowid
      AND ((SELECT mDiff FROM StoredProc_UpdateAge WHERE id = new.rowid) < 0
           OR (    (SELECT mDiff FROM StoredProc_UpdateAge WHERE id = new.rowid) = 0
               AND (SELECT strftime('%d',
                      DATE(new.asOf,
                           'start of month',
                           '+1 months',
                           '-1 days')) < strftime('%d', new.birthday))));

  -- update the specified family member record
  UPDATE FamilyMember
    SET age = (SELECT age FROM StoredProc_UpdateAge WHERE id = new.rowid)
    WHERE family_name = new.family_name
      AND member_name = new.member_name;

  --
  -- update the client with counts based on FamilyMember entries
  --
  -- This is slow, Slow, SLOW, as it recalculates counts after each
  -- family member age is calculated, rather than once after all
  -- family members' ages are calculated. There is no current
  -- implementation to do the latter, though, and this should be fast
  -- enough for ~1000 clients totalling ~4000 family members. We'll see.
  --
  UPDATE Client
    SET count_elderly =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND age >= 80)
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_senior =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND age >= 65)
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_adult =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND age >= 18 AND age < 65)
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_young_adult =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND age >= 18 AND age < 25)
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_child =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND age < 18 AND age >= 0)
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_sex_male =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND gender = 'M')
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_sex_female =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND gender = 'F')
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_sex_other =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND gender = 'O')
      WHERE family_name = new.family_name;

  UPDATE Client
    SET count_veteran =
      (SELECT COUNT(*)
         FROM FamilyMember
         WHERE family_name = new.family_name
           AND is_veteran = 1)
      WHERE family_name = new.family_name;

  DELETE FROM StoredProc_UpdateAge
    WHERE id = new.rowid;
END;

-- To update all FamilyMember records with current age:
-- INSERT INTO StoredProc_UpdateAge
--     (birthday, asOf, family_name, member_name)
--   SELECT date_of_birth, strftime('%Y-%m-%d', 'now'), family_name, member_name
--     FROM FamilyMember;

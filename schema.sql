--
-- Compare with mdb-to-sqlite.sh. Latest is likely there
--

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
  ethnicity                 VARCHAR,
  count_senior              INTEGER DEFAULT 0,  -- number of family members 65+
  count_adult               INTEGER DEFAULT 0,  -- number of family members 18-64
  count_child               INTEGER DEFAULT 0,  -- number of family members 0-17
  count_sex_male            INTEGER DEFAULT 0,
  count_sex_female          INTEGER DEFAULT 0,
  count_sex_other           INTEGER DEFAULT 0,
  count_veteran             INTEGER DEFAULT 0,
  income_source             VARCHAR,
  income_amount             REAL,
  usda_eligible             VARCHAR NOT NULL DEFAULT '',
  usda_eligible_next_distro VARCHAR DEFAULT NULL,
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
-- ALTER TABLE Client ADD COLUMN perishables_default VARCHAR NOT NULL DEFAULT '-- ALTER TABLE Client ADD COLUMN usda_eligible VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE Client ADD COLUMN usda_eligible_next_distro VARCHAR DEFAULT NULL;

--
-- Maintain a permanent copy of the next-distribution eligibility, per
-- distribution, so that the USDA report can be generated for any
-- distribution
--
-- First, for a new client...
CREATE TRIGGER tr_ai_Client
AFTER INSERT ON Client
BEGIN
  REPLACE INTO UsdaEligibleNextDistro (
      distribution,
      family_name,
      usda_eligible_next_distro
    ) VALUES (
      (SELECT MAX(start_date) FROM DistributionPeriod),
      new.family_name,
      new.usda_eligible_next_distro
    );
END;

-- ... and then for an update of an existing client
CREATE TRIGGER tr_au_Client
AFTER UPDATE ON Client
BEGIN
  REPLACE INTO UsdaEligibleNextDistro (
      distribution,
      family_name,
      usda_eligible_next_distro
    ) VALUES (
      (SELECT MAX(start_date) FROM DistributionPeriod),
      new.family_name,
      new.usda_eligible_next_distro
    );

  DELETE FROM UsdaEligibleNextDistro
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
  usda_eligible_signature VARCHAR DEFAULT NULL,
  PRIMARY KEY (distribution, family_name)
);

-- ALTER TABLE Fulfillment ADD COLUMN perishables VARCHAR;
-- ALTER TABLE Fulfillment ADD COLUMN usda_eligible_signature VARCHAR DEFAULT NULL;
-- ALTER TABLE Fulfillment DROP COLUMN is_usda_current;


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
  number_style      VARCHAR,
  number_remaining  VARCHAR,
  UNIQUE (name COLLATE NOCASE)
);

-- ALTER TABLE Report ADD COLUMN pre_query VARCHAR;

CREATE TABLE UsdaMaxIncome
(
  family_size       INTEGER PRIMARY KEY,
  max_income_num    INTEGER NOT NULL,
  max_income_text   VARCHAR NOT NULL
);

INSERT INTO UsdaMaxIncome VALUES (1, 2683, '$2,683');
INSERT INTO UsdaMaxIncome VALUES (2, 3629, '$3,629');
INSERT INTO UsdaMaxIncome VALUES (3, 4575, '$4,575');
INSERT INTO UsdaMaxIncome VALUES (4, 5521, '$5,521');
INSERT INTO UsdaMaxIncome VALUES (5, 6467, '$6,467');
INSERT INTO UsdaMaxIncome VALUES (6, 7413, '$7,413');
INSERT INTO UsdaMaxIncome VALUES (7, 8358, '$8,358');
INSERT INTO UsdaMaxIncome VALUES (8, 9304, '$9,304');
INSERT INTO UsdaMaxIncome VALUES (9, 10250, '$10,250');
INSERT INTO UsdaMaxIncome VALUES (10, 11196, '$11,196');
INSERT INTO UsdaMaxIncome VALUES (11, 12142, '$12,142');
INSERT INTO UsdaMaxIncome VALUES (12, 13088, '$13,088');
INSERT INTO UsdaMaxIncome VALUES (13, 14034, '$14,034');
INSERT INTO UsdaMaxIncome VALUES (14, 14980, '$14,980');


CREATE TABLE UsdaEligibleNextDistro
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
  -- age = today.year - birthday.year
  UPDATE StoredProc_UpdateAge
    SET age =
      (SELECT strftime('%Y', new.asOf)) -
      (SELECT strftime('%Y', new.birthday))
    WHERE id = new.rowid;

  -- mDiff = today.month - birthday.month
  -- (see if birthday month has passed yet)
  UPDATE StoredProc_UpdateAge
    SET mDiff =
      (SELECT strftime('%m', new.asOf)) -
      (SELECT strftime('%m', new.birthday))
    WHERE id = new.rowid;

  -- if (mDiff < 0 || (mDiff === 0 && today.day < birthday.day)) --age;
  UPDATE StoredProc_UpdateAge
    SET age = age - 1
    WHERE id == new.rowid
      AND ((SELECT mDiff FROM StoredProc_UpdateAge WHERE id = new.rowid) < 0
           OR (    (SELECT mDiff FROM StoredProc_UpdateAge WHERE id = new.rowid) = 0
               AND (SELECT strftime('%d', new.asOf) < strftime('%d', new.birthday))));

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

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
  family_name         VARCHAR PRIMARY KEY NOT NULL,
  phone               VARCHAR,
  email               VARCHAR,
  ethnicity           VARCHAR,
  count_senior        INTEGER DEFAULT 0,  -- number of family members 65+
  count_adult         INTEGER DEFAULT 0,  -- number of family members 18-64
  count_child         INTEGER DEFAULT 0,  -- number of family members 0-17
  count_sex_male      INTEGER DEFAULT 0,
  count_sex_female    INTEGER DEFAULT 0,
  count_sex_other     INTEGER DEFAULT 0,
  count_veteran       INTEGER DEFAULT 0,
  income_source       VARCHAR,
  income_amount       REAL,
  pet_types           VARCHAR,
  address_default     VARCHAR, -- default address for delivery
  appt_day_default    INTEGER, -- default appt day, 1-relative to Distr start
  appt_time_default   VARCHAR, -- default appt time HH:MM,
  verified            BOOLEAN DEFAULT FALSE,
  archived            BOOLEAN DEFAULT FALSE,
  notes_default       VARCHAR NOT NULL DEFAULT '',
  perishables_default VARCHAR NOT NULL DEFAULT '',
  UNIQUE (family_name COLLATE NOCASE)
);

-- Changes from original to derive the above table
--
-- ALTER TABLE Client ADD COLUMN notes_default VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE Client ADD COLUMN perishables_default VARCHAR NOT NULL DEFAULT '';



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

  UNIQUE (member_name COLLATE NOCASE),
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
  PRIMARY KEY (distribution, family_name)
);

-- ALTER TABLE Fulfillment ADD COLUMN perishables VARCHAR;


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
  -- start/end per day, if we need more than one week.
  day_1_first_appt  VARCHAR,    -- %H:%M
  day_1_last_appt   VARCHAR,
  day_2_first_appt  VARCHAR,
  day_2_last_appt   VARCHAR,
  day_3_first_appt  VARCHAR,
  day_3_last_appt   VARCHAR,
  day_4_first_appt  VARCHAR,
  day_4_last_appt   VARCHAR,
  day_5_first_appt  VARCHAR,
  day_5_last_appt   VARCHAR,
  day_6_first_appt  VARCHAR,
  day_6_last_appt   VARCHAR,
  day_7_first_appt  VARCHAR,
  day_7_last_appt   VARCHAR
);


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


CREATE TABLE KeyValueStore
(
  key               VARCHAR PRIMARY KEY NOT NULL,
  value             VARCHAR
);


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

  -- if (mDiff < 0 || (mDiff === 0 && today.day <= birthday.day)) --age;
  UPDATE StoredProc_UpdateAge
    SET age = age - 1
    WHERE id == new.rowid
      AND ((SELECT mDiff FROM StoredProc_UpdateAge WHERE id = new.rowid) < 0
           OR (    (SELECT mDiff FROM StoredProc_UpdateAge WHERE id = new.rowid) = 0
               AND (SELECT
                      strftime('%d', new.asOf)
                      <=
                      strftime('%d', new.birthday))));

  -- update the specified family member record
  UPDATE FamilyMember
    SET age = (SELECT age FROM StoredProc_UpdateAge WHERE id = new.rowid)
    WHERE family_name = new.family_name
      AND member_name = new.member_name;

  DELETE FROM StoredProc_UpdateAge
    WHERE id = new.rowid;
END;

-- To update all FamilyMember records with current age:
-- INSERT INTO StoredProc_UpdateAge
--     (birthday, asOf, family_name, member_name)
--   SELECT date_of_birth, strftime('%Y-%m-%d', 'now'), family_name, member_name
--     FROM FamilyMember;
